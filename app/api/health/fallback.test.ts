import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const ledgers = JSON.stringify({
  _embedded: { records: [{ operation_count: 3 }, { operation_count: 4 }] },
});

describe("GET /api/health Horizon fallback", () => {
  const previousFlag = process.env.LUMENMAP_HORIZON_FALLBACK;
  const previousMock = process.env.LUMENMAP_HORIZON_MOCK;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.LUMENMAP_HORIZON_FALLBACK;
    else process.env.LUMENMAP_HORIZON_FALLBACK = previousFlag;
    if (previousMock === undefined) delete process.env.LUMENMAP_HORIZON_MOCK;
    else process.env.LUMENMAP_HORIZON_MOCK = previousMock;
  });

  it("reports fallback inactive when the flag is off", async () => {
    delete process.env.LUMENMAP_HORIZON_FALLBACK;
    process.env.LUMENMAP_HORIZON_MOCK = ledgers;
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/health"));
    const body = (await response.json()) as {
      fallback: { active: boolean; operationCount: number | null };
    };
    assert.equal(body.fallback.active, false);
    assert.equal(body.fallback.operationCount, null);
  });

  it("reports the mocked Horizon count when the flag is on and BigQuery is not healthy", async () => {
    process.env.LUMENMAP_HORIZON_FALLBACK = "1";
    process.env.LUMENMAP_HORIZON_MOCK = ledgers;
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/health"));
    const body = (await response.json()) as {
      checks: { bigquery: { status: string } };
      fallback: { active: boolean; source: string; operationCount: number | null };
    };
    assert.notEqual(body.checks.bigquery.status, "ok");
    assert.equal(body.fallback.active, true);
    assert.equal(body.fallback.source, "horizon");
    assert.equal(body.fallback.operationCount, 7);
  });
});
