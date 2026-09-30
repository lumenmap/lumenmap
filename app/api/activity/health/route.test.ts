import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { queryRegistry } from "@/lib/hubble/queries";
import { GET, handleActivityHealthRequest } from "./route";

const previousSource = process.env.LUMENMAP_DATA_SOURCE;
afterEach(() => {
  if (previousSource === undefined) delete process.env.LUMENMAP_DATA_SOURCE;
  else process.env.LUMENMAP_DATA_SOURCE = previousSource;
});

describe("GET /api/activity/health", () => {
  test("reports fixture mode without claiming upstream queries were probed", async () => {
    process.env.LUMENMAP_DATA_SOURCE = "fixture";
    const response = await GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "healthy",
      source: "fixture",
      queries: [],
    });
  });

  test("reports every live query with status and latency", async () => {
    process.env.LUMENMAP_DATA_SOURCE = "live";
    const response = await handleActivityHealthRequest(async (_sql, params) => {
      assert.ok(params.start || Object.keys(params).length === 0 || params.ids);
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "healthy");
    assert.equal(body.source, "live");
    assert.equal(body.queries.length, queryRegistry.length + 2);
    assert.deepEqual(body.queries.map((check: { name: string }) => check.name), [
      ...queryRegistry.map((query) => query.name),
      "hourlyTimeseriesQuery",
      "dailyTimeseriesQuery",
    ]);
    for (const check of body.queries) {
      assert.equal(check.status, "ok");
      assert.ok(Number.isInteger(check.latencyMs) && check.latencyMs >= 0);
      assert.equal("errorCode" in check, false);
    }
  });

  test("identifies the failing query without returning provider text or SQL", async () => {
    process.env.LUMENMAP_DATA_SOURCE = "live";
    const providerText = "Unrecognized name: details at [12:5] SELECT private_sql";
    const response = await handleActivityHealthRequest(async (sql) => {
      if (sql === queryRegistry[0].sql) {
        throw Object.assign(new Error(providerText), {
          errors: [{ reason: "invalidQuery" }],
        });
      }
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.status, "unavailable");
    assert.deepEqual(body.queries[0], {
      name: queryRegistry[0].name,
      status: "error",
      latencyMs: body.queries[0].latencyMs,
      errorCode: "QUERY_INVALID",
    });
    assert.equal(body.queries.slice(1).every((check: { status: string }) => check.status === "ok"), true);
    assert.equal(JSON.stringify(body).includes(providerText), false);
    assert.equal(JSON.stringify(body).includes("SELECT"), false);
  });
});
