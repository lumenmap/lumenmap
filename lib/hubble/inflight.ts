/**
 * Tracks in-flight promises by key so concurrent identical callers share one
 * provider invocation. Entries are cleared after success or failure.
 */
export function coalesceInflight<T>(
  store: Map<string, Promise<T>>,
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = store.get(key);
  if (existing) {
    return existing;
  }

  const promise = factory().finally(() => {
    store.delete(key);
  });

  store.set(key, promise);
  return promise;
}
