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

const cache = new Map<string, { data: unknown; expires: number }>();

export function clearCache(): void {
  cache.clear();
}

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
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
    expires: Date.now() + validTtl * 1000,
  });
}

