import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getDailyBudgetSnapshot,
  getDailyBytesBudget,
  getDailyBytesUsed,
  isDailyBudgetHardFailEnabled,
  recordDailyBytesBilled,
  resetDailyBytesBudget,
  shouldHardFailNonCriticalQuery,
  utcDayKey,
} from "./bytes-budget";

describe("daily bytes budget", () => {
  const previous = {
    budget: process.env.BIGQUERY_DAILY_BYTES_BUDGET,
    soft: process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO,
    hard: process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL,
  };

  beforeEach(() => {
    resetDailyBytesBudget();
    delete process.env.BIGQUERY_DAILY_BYTES_BUDGET;
    delete process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO;
    delete process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL;
  });

  afterEach(() => {
    resetDailyBytesBudget();
    for (const [key, value] of Object.entries({
      BIGQUERY_DAILY_BYTES_BUDGET: previous.budget,
      BIGQUERY_DAILY_BUDGET_SOFT_RATIO: previous.soft,
      BIGQUERY_DAILY_BUDGET_HARD_FAIL: previous.hard,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("sums samples for the current UTC day only", () => {
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "1000";
    const now = Date.parse("2026-11-24T12:00:00.000Z");
    recordDailyBytesBilled(100, now - 60_000);
    recordDailyBytesBilled(200, now);
    recordDailyBytesBilled(999, Date.parse("2026-11-23T23:00:00.000Z"));
    assert.equal(getDailyBytesUsed(now), 300);
    assert.equal(utcDayKey(now), "2026-11-24");
  });

  it("reports soft_warn at the configured ratio without going over", () => {
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "1000";
    process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO = "0.8";
    const now = Date.parse("2026-11-24T12:00:00.000Z");
    recordDailyBytesBilled(800, now);
    const snap = getDailyBudgetSnapshot(now);
    assert.equal(snap.status, "soft_warn");
    assert.equal(snap.usedBytes, 800);
    assert.equal(snap.remainingBytes, 200);
    assert.equal(snap.budgetBytes, 1000);
  });

  it("reports over when used exceeds the budget", () => {
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "100";
    const now = Date.parse("2026-11-24T12:00:00.000Z");
    recordDailyBytesBilled(150, now);
    const snap = getDailyBudgetSnapshot(now);
    assert.equal(snap.status, "over");
    assert.equal(snap.remainingBytes, 0);
  });

  it("hard-fails non-critical queries only when enabled and over budget", () => {
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "10";
    const now = Date.parse("2026-11-24T12:00:00.000Z");
    recordDailyBytesBilled(11, now);
    assert.equal(shouldHardFailNonCriticalQuery(now), false);
    process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL = "true";
    assert.equal(isDailyBudgetHardFailEnabled(), true);
    assert.equal(shouldHardFailNonCriticalQuery(now), true);
  });

  it("reads the configured daily budget", () => {
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "42";
    assert.equal(getDailyBytesBudget(), 42);
  });
});
