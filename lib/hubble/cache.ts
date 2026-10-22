import { metrics } from "@/lib/telemetry/metrics";
import { getCacheDriver } from "@/lib/cache";
import { freshnessBroadcaster } from "@/lib/hubble/freshness";

export const DEFAULT_CACHE_TTL_SECONDS = 900;
export const MIN_CACHE_TTL_SECONDS = 1;
export const MAX_CACHE_TTL_SECONDS = 86_400;

export function parseCacheTtl(input?: unknown): number {
  if (input === undefined || input === null) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  if (typeof input === "string" && input.trim() === "") {
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  const num = typeof input === "number" ? input : Number(input);

  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  if (num < MIN_CACHE_TTL_SECONDS || num > MAX_CACHE_TTL_SECONDS) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  return Math.floor(num);
}

type Clock = () => number;

let now: Clock = () => Date.now();

/** Inject a clock for deterministic cache expiry tests. */
export function setClock(clock: Clock): void {
  now = clock;
}

export function clearCache(): void {
  getCacheDriver().clear();
  freshnessBroadcaster.notifyCacheRotation(undefined, "cache_clear");
}

export function getCached<T>(
  key: string,
  options?: { endpoint?: "activity"; track?: boolean },
): T | null {
  const track = options?.track === true;
  const endpoint = options?.endpoint ?? "activity";
  const driver = getCacheDriver();
  const entry = driver.get(key);
  if (!entry) {
    if (track) {
      metrics.increment({ endpoint, cache_outcome: "miss" });
    }
    return null;
  }

  if (now() > entry.expires) {
    driver.delete(key);
    if (track) {
      metrics.increment({ endpoint, cache_outcome: "miss" });
    }
    return null;
  }

  if (track) {
    metrics.increment({ endpoint, cache_outcome: "hit" });
  }
  return entry.data as T;
}

export function setCache(
  key: string,
  data: unknown,
  ttlSeconds?: unknown,
): void {
  const validTtl = parseCacheTtl(
    ttlSeconds ?? process.env.CACHE_TTL_SECONDS,
  );

  getCacheDriver().set(
    key,
    {
      data,
      expires: now() + validTtl * 1000,
    },
    validTtl,
  );
  pruneCache();
  freshnessBroadcaster.notifyCacheRotation([key], "cache_set");
}

/**
 * Remove expired entries even when their keys are never read again.
 * Invoked on writes so work stays bounded to request-time paths.
 */
export function pruneCache(): void {
  const currentTime = now();
  const driver = getCacheDriver();
  for (const [key, entry] of driver.entries()) {
    if (currentTime > entry.expires) {
      driver.delete(key);
    }
  }
}
