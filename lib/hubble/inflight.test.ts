import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { coalesceInflight } from "./inflight";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("coalesceInflight", () => {
  test("concurrent callers for one key invoke the factory once", async () => {
    const store = new Map<string, Promise<string>>();
    let calls = 0;
    const deferred = createDeferred<string>();

    const factory = () => {
      calls += 1;
      return deferred.promise;
    };

    const p1 = coalesceInflight(store, "k", factory);
    const p2 = coalesceInflight(store, "k", factory);

    assert.equal(calls, 1);
    assert.equal(store.has("k"), true);

    deferred.resolve("ok");
    assert.equal(await p1, "ok");
    assert.equal(await p2, "ok");
    assert.equal(store.has("k"), false);
  });

  test("different keys invoke factories independently", async () => {
    const store = new Map<string, Promise<string>>();
    let calls = 0;
    const a = createDeferred<string>();
    const b = createDeferred<string>();

    const p1 = coalesceInflight(store, "a", () => {
      calls += 1;
      return a.promise;
    });
    const p2 = coalesceInflight(store, "b", () => {
      calls += 1;
      return b.promise;
    });

    assert.equal(calls, 2);
    a.resolve("A");
    b.resolve("B");
    assert.equal(await p1, "A");
    assert.equal(await p2, "B");
  });

  test("failed promise is not retained and a later call retries", async () => {
    const store = new Map<string, Promise<string>>();
    let calls = 0;
    const first = createDeferred<string>();

    const p1 = coalesceInflight(store, "k", () => {
      calls += 1;
      return first.promise;
    });

    first.reject(new Error("boom"));
    await assert.rejects(p1, /boom/);
    assert.equal(store.has("k"), false);

    const p2 = coalesceInflight(store, "k", async () => {
      calls += 1;
      return "recovered";
    });

    assert.equal(await p2, "recovered");
    assert.equal(calls, 2);
  });

  test("in-flight entries are removed after settlement", async () => {
    const store = new Map<string, Promise<number>>();
    const deferred = createDeferred<number>();
    const p = coalesceInflight(store, "n", () => deferred.promise);
    assert.equal(store.size, 1);
    deferred.resolve(1);
    await p;
    assert.equal(store.size, 0);
  });
});
