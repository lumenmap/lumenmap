import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  formatDailyBurnLine,
  getDailyBudgetSnapshot,
  getRollingBytesBilled,
  recordBytesBilled,
  resetBytesBilledTelemetry,
  shouldBlockNonCriticalQuery,
} from "@/lib/hubble/bytes-billed-telemetry";

describe("health bytes-billed readiness and daily budget guardrail (#461)", () => {
  const previous = {
    fixture: process.env.LUMENMAP_DATA_SOURCE,
    threshold: process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD,
    window: process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES,
    dailyBudget: process.env.BIGQUERY_DAILY_BYTES_BUDGET,
    softRatio: process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO,
    hardFail: process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL_NON_CRITICAL,
  };

  beforeEach(() => {
    resetBytesBilledTelemetry();
    delete process.env.LUMENMAP_DATA_SOURCE;
    process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES = "15";
    process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = "1000";
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "5000";
    process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO = "0.8";
    delete process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL_NON_CRITICAL;
  });

  afterEach(() => {
    resetBytesBilledTelemetry();
    if (previous.fixture === undefined) delete process.env.LUMENMAP_DATA_SOURCE;
    else process.env.LUMENMAP_DATA_SOURCE = previous.fixture;
    if (previous.threshold === undefined) {
      delete process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD;
    } else {
      process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = previous.threshold;
    }
    if (previous.window === undefined) {
      delete process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES;
    } else {
      process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES = previous.window;
    }
    if (previous.dailyBudget === undefined) {
      delete process.env.BIGQUERY_DAILY_BYTES_BUDGET;
    } else {
      process.env.BIGQUERY_DAILY_BYTES_BUDGET = previous.dailyBudget;
    }
    if (previous.softRatio === undefined) {
      delete process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO;
    } else {
      process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO = previous.softRatio;
    }
    if (previous.hardFail === undefined) {
      delete process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL_NON_CRITICAL;
    } else {
      process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL_NON_CRITICAL =
        previous.hardFail;
    }
  });

  it("reports zero bytes billed and full remaining daily budget in fixture mode", async () => {
    process.env.LUMENMAP_DATA_SOURCE = "fixture";
    recordBytesBilled(50_000);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/health?type=readiness"),
    );
    const body = (await response.json()) as {
      status: string;
      checks: {
        bigquery: { status: string; latencyMs: number };
        bytesBilled: {
          rollingBytesBilled: number;
          dailyBytesUsed: number;
          dailyBytesBudget: number;
          dailyBytesRemaining: number;
          softThresholdExceeded: boolean;
          status: string;
        };
      };
    };
    assert.equal(body.checks.bytesBilled.rollingBytesBilled, 0);
    assert.equal(body.checks.bytesBilled.dailyBytesUsed, 0);
    assert.equal(body.checks.bytesBilled.dailyBytesBudget, 5000);
    assert.equal(body.checks.bytesBilled.dailyBytesRemaining, 5000);
    assert.equal(body.checks.bytesBilled.softThresholdExceeded, false);
    assert.equal(body.checks.bytesBilled.status, "ok");
    assert.ok(["healthy", "degraded", "unavailable"].includes(body.status));
    assert.ok(Number.isInteger(body.checks.bigquery.latencyMs));
  });

  it("marks readiness degraded when rolling bytes exceed the threshold", async () => {
    recordBytesBilled(600);
    recordBytesBilled(500);
    assert.equal(getRollingBytesBilled() > 1000, true);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/health?type=readiness"),
    );
    const body = (await response.json()) as {
      status: string;
      checks: {
        bigquery: { status: string; latencyMs: number };
        bytesBilled: {
          rollingBytesBilled: number;
          status: string;
          message?: string;
        };
      };
    };
    assert.equal(body.checks.bytesBilled.status, "degraded");
    assert.ok((body.checks.bytesBilled.message ?? "").includes("exceeded"));
    assert.equal(
      body.status === "degraded" || body.status === "unavailable",
      true,
    );
    assert.ok(
      ["ok", "degraded", "unavailable"].includes(body.checks.bigquery.status),
    );
    assert.ok(Number.isInteger(body.checks.bigquery.latencyMs));
  });

  it("computes daily budget math, warns on soft threshold without blocking core queries by default, and supports optional hard-fail", async () => {
    process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = "100000";
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "10000";
    process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO = "0.8";

    recordBytesBilled(8200);
    const snapshot = getDailyBudgetSnapshot();
    assert.equal(snapshot.dailyBytesUsed, 8200);
    assert.equal(snapshot.dailyBytesBudget, 10000);
    assert.equal(snapshot.dailyBytesRemaining, 1800);
    assert.equal(snapshot.softThresholdExceeded, true);
    assert.equal(snapshot.budgetExceeded, false);
    assert.equal(shouldBlockNonCriticalQuery(), false);
    assert.ok(formatDailyBurnLine(snapshot).includes("SOFT WARNING"));

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/health?type=readiness"),
    );
    const body = (await response.json()) as {
      checks: {
        bytesBilled: {
          status: string;
          dailyBytesUsed: number;
          dailyBytesRemaining: number;
          softThresholdExceeded: boolean;
          hardFailNonCriticalActive: boolean;
          message?: string;
        };
      };
    };
    assert.equal(body.checks.bytesBilled.status, "degraded");
    assert.equal(body.checks.bytesBilled.dailyBytesUsed, 8200);
    assert.equal(body.checks.bytesBilled.dailyBytesRemaining, 1800);
    assert.equal(body.checks.bytesBilled.softThresholdExceeded, true);
    assert.equal(body.checks.bytesBilled.hardFailNonCriticalActive, false);

    recordBytesBilled(2500);
    assert.equal(getDailyBudgetSnapshot().budgetExceeded, true);
    assert.equal(shouldBlockNonCriticalQuery(), false);

    process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL_NON_CRITICAL = "true";
    assert.equal(shouldBlockNonCriticalQuery(), true);
  });
});
