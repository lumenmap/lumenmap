import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHorizonFallbackReport,
  estimateRecentOperations,
  isHorizonFallbackEnabled,
} from "./fallback";

const ledgers = {
  _embedded: { records: [{ operation_count: 3 }, { operation_count: 4 }] },
};

describe("Horizon fallback", () => {
  it("stays off unless the flag is explicitly on", () => {
    assert.equal(isHorizonFallbackEnabled({} as NodeJS.ProcessEnv), false);
    assert.equal(isHorizonFallbackEnabled({ LUMENMAP_HORIZON_FALLBACK: "0" } as NodeJS.ProcessEnv), false);
    assert.equal(isHorizonFallbackEnabled({ LUMENMAP_HORIZON_FALLBACK: "1" } as NodeJS.ProcessEnv), true);
  });

  it("sums a Horizon ledger sample and rejects a malformed one", () => {
    assert.equal(estimateRecentOperations(ledgers), 7);
    assert.equal(
      estimateRecentOperations({ _embedded: { records: [{ operation_count: 1.5 }] } }),
      null,
    );
  });

  it("keeps the Hubble path when Hubble is healthy, even if the flag is on", () => {
    assert.deepEqual(
      buildHorizonFallbackReport({
        flagEnabled: true,
        hubbleStatus: "ok",
        horizonSample: ledgers,
      }),
      { active: false, source: "none", operationCount: null },
    );
  });

  it("uses only the Horizon estimate when Hubble is down and the flag is on", () => {
    assert.deepEqual(
      buildHorizonFallbackReport({
        flagEnabled: true,
        hubbleStatus: "unavailable",
        horizonSample: ledgers,
      }),
      { active: true, source: "horizon", operationCount: 7 },
    );
  });

  it("does not report a Horizon number when the flag is off", () => {
    assert.deepEqual(
      buildHorizonFallbackReport({
        flagEnabled: false,
        hubbleStatus: "unavailable",
        horizonSample: ledgers,
      }),
      { active: false, source: "none", operationCount: null },
    );
  });
});
