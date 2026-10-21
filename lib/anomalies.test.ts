import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectKpiAnomalies, QUIET_FIXTURE, SPIKE_FIXTURE } from "@/lib/anomalies";

describe("detectKpiAnomalies", () => {
  it("reports a spike when the fixture exceeds thresholds", () => {
    const findings = detectKpiAnomalies(SPIKE_FIXTURE);
    assert.equal(findings.length, 3);
    assert.ok(findings.every((finding) => finding.direction === "spike"));
    assert.equal(findings[0]?.inspectHref.includes("metric=ops"), true);
  });

  it("stays quiet when changes are inside the thresholds", () => {
    assert.deepEqual(detectKpiAnomalies(QUIET_FIXTURE), []);
  });

  it("does not banner when the period is incomplete", () => {
    assert.deepEqual(detectKpiAnomalies({ ...SPIKE_FIXTURE, complete: false }), []);
  });

  it("does not banner when the baseline is missing", () => {
    assert.deepEqual(detectKpiAnomalies({ ...SPIKE_FIXTURE, baseline: null }), []);
  });

  it("skips a metric whose current value is missing", () => {
    const findings = detectKpiAnomalies({
      complete: true,
      baseline: SPIKE_FIXTURE.baseline,
      current: { ...SPIKE_FIXTURE.current, ops: null },
    });
    assert.equal(findings.some((finding) => finding.metric === "ops"), false);
    assert.equal(findings.length, 2);
  });
});
