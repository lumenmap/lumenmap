import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  resolveDirectoryConfig,
  resolveEntityLabels,
} from "./resolve-labels";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("resolveDirectoryConfig", () => {
  test("applies defaults and clamps out-of-range values", () => {
    assert.deepEqual(resolveDirectoryConfig(undefined), {
      timeoutMs: 5_000,
      concurrency: 3,
    });
    assert.equal(resolveDirectoryConfig({ timeoutMs: 50 }).timeoutMs, 5_000);
    assert.equal(resolveDirectoryConfig({ timeoutMs: 70_000 }).timeoutMs, 5_000);
    assert.equal(resolveDirectoryConfig({ concurrency: 0 }).concurrency, 3);
    assert.equal(resolveDirectoryConfig({ concurrency: 99 }).concurrency, 3);
    assert.equal(resolveDirectoryConfig({ timeoutMs: 100, concurrency: 1 }).timeoutMs, 100);
    assert.equal(resolveDirectoryConfig({ timeoutMs: 100, concurrency: 1 }).concurrency, 1);
  });
});

describe("resolveEntityLabels timeouts and concurrency", () => {
  test("successful directory batch resolves labels", async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({
          _embedded: {
            records: [
              {
                address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOP",
                name: "Example",
                domain: "example.com",
                tags: ["exchange"],
              },
            ],
          },
        }),
        { status: 200 },
      )) as typeof fetch;

    const labels = await resolveEntityLabels(
      ["GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOP"],
      { fetch: fetchFn, directoryConfig: { timeoutMs: 1000, concurrency: 1 } },
    );

    assert.equal(
      labels["GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOP"]?.name,
      "Example",
    );
  });

  test("non-ok HTTP response yields empty map for that batch", async () => {
    const fetchFn = (async () =>
      new Response("nope", { status: 500 })) as typeof fetch;
    const labels = await resolveEntityLabels(["GABC"], {
      fetch: fetchFn,
      directoryConfig: { timeoutMs: 1000, concurrency: 1 },
      fetchHomeDomains: async () => ({}),
    });
    assert.equal(Object.keys(labels).length, 0);
  });

  test("timed-out batch returns empty and preserves later success via fallback", async () => {
    const deferred = createDeferred<Response>();
    let calls = 0;
    const fetchFn = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const signal = init?.signal;
      if (signal) {
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return await new Promise<Response>((resolve, reject) => {
          const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
          signal.addEventListener("abort", onAbort, { once: true });
          deferred.promise.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", onAbort);
          });
        });
      }
      return deferred.promise;
    }) as typeof fetch;

    const labelsPromise = resolveEntityLabels(["GABC"], {
      fetch: fetchFn,
      directoryConfig: { timeoutMs: 30, concurrency: 1 },
      fetchHomeDomains: async () => ({
        GABC: { name: "Fallback", category: "account", protocol: "x.com" },
      }),
    });

    const labels = await labelsPromise;
    assert.equal(calls >= 1, true);
    assert.equal(labels.GABC?.name, "Fallback");
  });

  test("concurrency limits in-flight directory requests", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const gates: Array<() => void> = [];

    const fetchFn = (async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => gates.push(resolve));
      inFlight -= 1;
      return new Response(JSON.stringify({ _embedded: { records: [] } }), {
        status: 200,
      });
    }) as typeof fetch;

    // 3 batches of 50 with concurrency 2
    const ids = Array.from({ length: 150 }, (_, i) => `C${String(i).padStart(55, "0")}`);
    const done = resolveEntityLabels(ids, {
      fetch: fetchFn,
      directoryConfig: { timeoutMs: 5_000, concurrency: 2 },
      fetchHomeDomains: async () => ({}),
    });

    // Wait until 2 are in flight
    for (let i = 0; i < 50 && maxInFlight < 2; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.equal(maxInFlight, 2);

    // Release gates as workers enqueue them until settlement.
    for (let i = 0; i < 200; i++) {
      while (gates.length) gates.shift()!();
      const raced = await Promise.race([
        done.then(() => "done" as const),
        new Promise<"wait">((r) => setTimeout(() => r("wait"), 5)),
      ]);
      if (raced === "done") break;
    }
    await done;
    assert.ok(maxInFlight <= 2);
  });
});
