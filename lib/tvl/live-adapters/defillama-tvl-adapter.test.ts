import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DefiLlamaTvlAdapter } from "./defillama-tvl-adapter";

function fakeFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return ((url: string, init?: RequestInit) => impl(url, init)) as typeof fetch;
}

describe("DefiLlamaTvlAdapter", () => {
  it("returns a complete result when the API returns a bare number", async () => {
    const adapter = new DefiLlamaTvlAdapter("Soroswap", "soroswap", {
      fetchImpl: fakeFetch(async () =>
        new Response(JSON.stringify(4790000), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    });

    const result = await adapter.getTvl();

    assert.equal(result.status, "complete");
    assert.equal(result.protocol, "Soroswap");
    assert.equal(result.network, "stellar");
    assert.ok(result.snapshotTime);
    if (result.status === "complete") {
      assert.equal(result.positions.length, 1);
      assert.equal(result.positions[0].usdValue, "4790000");
      assert.equal(result.positions[0].priceProvenance.source, "defillama");
    } else {
      assert.fail("expected a complete result");
    }
  });

  it("returns a complete result when the API returns an object with a tvl field", async () => {
    const adapter = new DefiLlamaTvlAdapter("Soroswap", "soroswap", {
      fetchImpl: fakeFetch(async () =>
        new Response(JSON.stringify({ tvl: 123.45 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    });

    const result = await adapter.getTvl();
    assert.equal(result.status, "complete");
    if (result.status === "complete") {
      assert.equal(result.positions[0].usdValue, "123.45");
    } else {
      assert.fail("expected a complete result");
    }
  });

  it("returns failed, not a throw, on a non-OK HTTP response", async () => {
    const adapter = new DefiLlamaTvlAdapter("Soroswap", "soroswap", {
      fetchImpl: fakeFetch(async () => new Response("not found", { status: 404 })),
    });

    const result = await adapter.getTvl();

    assert.equal(result.status, "failed");
    if (result.status === "failed") {
      assert.match(result.error, /HTTP 404/);
    } else {
      assert.fail("expected a failed result");
    }
  });

  it("returns failed, not a throw, when the response body is not numeric", async () => {
    const adapter = new DefiLlamaTvlAdapter("Soroswap", "soroswap", {
      fetchImpl: fakeFetch(async () =>
        new Response(JSON.stringify({ unexpected: "shape" }), { status: 200 }),
      ),
    });

    const result = await adapter.getTvl();
    assert.equal(result.status, "failed");
  });

  it("returns failed, not a throw, when fetch itself rejects", async () => {
    const adapter = new DefiLlamaTvlAdapter("Soroswap", "soroswap", {
      fetchImpl: fakeFetch(async () => {
        throw new Error("network down");
      }),
    });

    const result = await adapter.getTvl();

    assert.equal(result.status, "failed");
    if (result.status === "failed") {
      assert.equal(result.error, "network down");
    } else {
      assert.fail("expected a failed result");
    }
  });

  it("returns failed, not a throw, when the request times out", async () => {
    const adapter = new DefiLlamaTvlAdapter("Soroswap", "soroswap", {
      timeoutMs: 10,
      fetchImpl: fakeFetch(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            // A real fetch rejects with an AbortError when its signal
            // fires; mirror that so this test exercises the adapter's own
            // AbortController/timeout path instead of an unrelated timer.
            init?.signal?.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      ),
    });

    const result = await adapter.getTvl();

    assert.equal(result.status, "failed");
    if (result.status === "failed") {
      assert.match(result.error, /timed out/);
    } else {
      assert.fail("expected a failed result");
    }
  });
});
