import { metrics } from "@/lib/telemetry/metrics";
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

const cache = new Map<string, { data: unknown; expires: number }>();
let now: Clock = () => Date.now();

/** Inject a clock for deterministic cache expiry tests. */
export function setClock(clock: Clock): void {
  now = clock;
}

export function clearCache(): void {
  cache.clear();
}

export function getCached<T>(
  key: string,
  options?: { endpoint?: "activity"; track?: boolean },
): T | null {
  const track = options?.track === true;
  const endpoint = options?.endpoint ?? "activity";
  const entry = cache.get(key);
  if (!entry) {
    if (track) {
      metrics.increment({ endpoint, cache_outcome: "miss" });
    }
    return null;
  }

  if (now() > entry.expires) {
    cache.delete(key);
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

  cache.set(key, {
    data,
    expires: now() + validTtl * 1000,
  });
  pruneCache();
}

/**
 * Remove expired entries even when their keys are never read again.
 * Invoked on writes so work stays bounded to request-time paths.
 */
export function pruneCache(): void {
  const currentTime = now();
  for (const [key, entry] of cache) {
    if (currentTime > entry.expires) {
      cache.delete(key);
    }
  }
}
