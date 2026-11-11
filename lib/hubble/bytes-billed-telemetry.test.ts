import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  evaluateQueryBudgetGuardrail,
  extractTotalBytesBilled,
  formatDailyBurnLine,
  getBytesBilledDegradedThreshold,
  getBytesBilledWindowMinutes,
  getDailyBurnSummary,
  getDailyBytesBilled,
  getDailyBytesBudgetLimit,
  getDailyBytesSoftWarnPercent,
  getRollingBytesBilled,
  isDailyBytesBudgetExceeded,
  isDailyBytesBudgetHardFailEnabled,
  recordBytesBilled,
  resetBytesBilledTelemetry,
} from "./bytes-billed-telemetry";

describe("bytes-billed telemetry and daily cost budget guardrail", () => {
  const previous = {
    window: process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES,
    threshold: process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD,
    dailyBudget: process.env.BIGQUERY_DAILY_BYTES_BUDGET,
    softWarn: process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT,
    hardFail: process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL,
  };

  beforeEach(() => {
    resetBytesBilledTelemetry();
    delete process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES;
    delete process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD;
    delete process.env.BIGQUERY_DAILY_BYTES_BUDGET;
    delete process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT;
    delete process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL;
  });

  afterEach(() => {
    resetBytesBilledTelemetry();
    if (previous.window === undefined) {
      delete process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES;
    } else {
      process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES = previous.window;
    }
    if (previous.threshold === undefined) {
      delete process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD;
    } else {
      process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = previous.threshold;
    }
    if (previous.dailyBudget === undefined) {
      delete process.env.BIGQUERY_DAILY_BYTES_BUDGET;
    } else {
      process.env.BIGQUERY_DAILY_BYTES_BUDGET = previous.dailyBudget;
    }
    if (previous.softWarn === undefined) {
      delete process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT;
    } else {
      process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT = previous.softWarn;
    }
    if (previous.hardFail === undefined) {
      delete process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL;
    } else {
      process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL = previous.hardFail;
    }
  });

  it("aggregates samples inside the rolling window", () => {
    process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES = "15";
    const now = 100_000_000;
    recordBytesBilled(100, now - 14 * 60_000);
    recordBytesBilled(250, now - 60_000);
    recordBytesBilled(50, now);
    assert.equal(getRollingBytesBilled(now), 400);
  });

  it("drops samples older than the rolling window while retaining 24h daily samples", () => {
    process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES = "5";
    const now = 100_000_000;
    recordBytesBilled(999, now - 6 * 60_000);
    recordBytesBilled(10, now);
    assert.equal(getRollingBytesBilled(now), 10);
    assert.equal(getDailyBytesBilled(now), 1009);
  });

  it("enforces the 24h daily bytes budget guardrail and formats the daily burn dashboard line", () => {
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = String(2 * 1_073_741_824); // 2 GB
    assert.equal(getDailyBytesBudgetLimit(), 2 * 1_073_741_824);

    const now = 200_000_000;
    recordBytesBilled(1_073_741_824, now - 3600_000);
    assert.equal(isDailyBytesBudgetExceeded(now), false);

    const halfSummary = getDailyBurnSummary(now);
    assert.equal(halfSummary.utilizationPercent, 50);
    assert.ok(
      halfSummary.formattedLine.includes(
        "Daily BigQuery burn: 1.00 GB / 2.00 GB (50.0%",
      ),
    );

    recordBytesBilled(1_073_741_824, now);
    assert.equal(isDailyBytesBudgetExceeded(now), true);

    const fullSummary = getDailyBurnSummary(now);
    assert.equal(fullSummary.isExceeded, true);
    assert.equal(
      formatDailyBurnLine(2 * 1_073_741_824, 2 * 1_073_741_824),
      "Daily BigQuery burn: 2.00 GB / 2.00 GB (100.0% · ~$0.01)",
    );
  });

  it("parses mocked BigQuery job statistics", () => {
    assert.equal(
      extractTotalBytesBilled({
        statistics: { query: { totalBytesBilled: "12345" } },
      }),
      12345,
    );
    assert.equal(
      extractTotalBytesBilled({
        statistics: { query: { totalBytesBilled: 99 } },
      }),
      99,
    );
    assert.equal(extractTotalBytesBilled({}), 0);
  });

  it("computes remaining budget, soft warnings, and optional non-critical hard-fail without taking down core queries", () => {
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "1000";
    process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT = "80";
    assert.equal(getDailyBytesSoftWarnPercent(), 80);
    assert.equal(isDailyBytesBudgetHardFailEnabled(), false);

    const now = 300_000_000;
    recordBytesBilled(850, now - 5_000);

    const softDecision = evaluateQueryBudgetGuardrail({
      nonCritical: false,
      nowMs: now,
    });
    assert.equal(softDecision.summary.dailyBytesBilled, 850);
    assert.equal(softDecision.summary.dailyBytesRemaining, 150);
    assert.equal(softDecision.summary.isSoftWarning, true);
    assert.equal(softDecision.summary.isExceeded, false);
    assert.equal(softDecision.shouldWarn, true);
    assert.equal(softDecision.shouldHardFail, false);

    // Exhaust budget (1050 / 1000): by default neither core nor non-critical queries hard-fail.
    recordBytesBilled(200, now);
    const defaultCoreExceeded = evaluateQueryBudgetGuardrail({
      nonCritical: false,
      nowMs: now,
    });
    const defaultOptionalExceeded = evaluateQueryBudgetGuardrail({
      nonCritical: true,
      nowMs: now,
    });
    assert.equal(defaultCoreExceeded.summary.dailyBytesRemaining, 0);
    assert.equal(defaultCoreExceeded.summary.isExceeded, true);
    assert.equal(defaultCoreExceeded.shouldWarn, true);
    assert.equal(defaultCoreExceeded.shouldHardFail, false);
    assert.equal(defaultOptionalExceeded.shouldHardFail, false);

    // Enabling BIGQUERY_DAILY_BUDGET_HARD_FAIL=true sheds non-critical queries while keeping core queries online.
    process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL = "true";
    assert.equal(isDailyBytesBudgetHardFailEnabled(), true);
    const hardFailOptional = evaluateQueryBudgetGuardrail({
      nonCritical: true,
      nowMs: now,
    });
    const hardFailCore = evaluateQueryBudgetGuardrail({
      nonCritical: false,
      nowMs: now,
    });
    assert.equal(hardFailOptional.shouldHardFail, true);
    assert.equal(hardFailCore.shouldHardFail, false);
    assert.equal(hardFailCore.shouldWarn, true);
  });

  it("reads configured threshold and window", () => {
    process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES = "30";
    process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = "5000";
    assert.equal(getBytesBilledWindowMinutes(), 30);
    assert.equal(getBytesBilledDegradedThreshold(), 5000);
  });
});
