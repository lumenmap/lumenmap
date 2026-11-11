import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getRollingBytesBilled,
  recordBytesBilled,
  resetBytesBilledTelemetry,
} from "@/lib/hubble/bytes-billed-telemetry";

describe("health bytes-billed readiness", () => {
  const previous = {
    fixture: process.env.LUMENMAP_DATA_SOURCE,
    threshold: process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD,
    window: process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES,
    dailyBudget: process.env.BIGQUERY_DAILY_BYTES_BUDGET,
    softWarn: process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT,
  };

  beforeEach(() => {
    resetBytesBilledTelemetry();
    delete process.env.LUMENMAP_DATA_SOURCE;
    delete process.env.BIGQUERY_DAILY_BYTES_BUDGET;
    delete process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT;
    process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES = "15";
    process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = "1000";
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
    if (previous.softWarn === undefined) {
      delete process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT;
    } else {
      process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT = previous.softWarn;
    }
  });

  it("reports zero bytes billed and full remaining budget in fixture mode", async () => {
    process.env.LUMENMAP_DATA_SOURCE = "fixture";
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "10000";
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
          dailyBytesBilled: number;
          dailyBytesRemaining: number;
          dailyBytesBudget: number;
          status: string;
        };
      };
    };
    assert.equal(body.checks.bytesBilled.rollingBytesBilled, 0);
    assert.equal(body.checks.bytesBilled.dailyBytesBilled, 0);
    assert.equal(body.checks.bytesBilled.dailyBytesRemaining, 10000);
    assert.equal(body.checks.bytesBilled.dailyBytesBudget, 10000);
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
    assert.ok(
      (body.checks.bytesBilled.message ?? "").includes("exceeded"),
    );
    assert.equal(body.status === "degraded" || body.status === "unavailable", true);
    assert.ok(["ok", "degraded", "unavailable"].includes(body.checks.bigquery.status));
    assert.ok(Number.isInteger(body.checks.bigquery.latencyMs));
  });

  it("emits a soft warning and reports remaining budget before the daily ceiling is exhausted", async () => {
    process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = "1000000";
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "1000";
    process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT = "80";
    recordBytesBilled(850);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/health?type=readiness"),
    );
    const body = (await response.json()) as {
      status: string;
      checks: {
        bytesBilled: {
          status: string;
          dailyBytesBilled: number;
          dailyBytesRemaining: number;
          dailyBytesBudget: number;
          dailyBurnPercent: number;
          softWarnPercent: number;
          message?: string;
        };
      };
    };
    assert.equal(body.checks.bytesBilled.status, "degraded");
    assert.equal(body.checks.bytesBilled.dailyBytesBilled, 850);
    assert.equal(body.checks.bytesBilled.dailyBytesRemaining, 150);
    assert.equal(body.checks.bytesBilled.dailyBytesBudget, 1000);
    assert.equal(body.checks.bytesBilled.dailyBurnPercent, 85);
    assert.equal(body.checks.bytesBilled.softWarnPercent, 80);
    assert.ok(
      (body.checks.bytesBilled.message ?? "").includes(
        "soft warning threshold (80%)",
      ),
    );
  });

  it("marks readiness degraded and reports zero remaining bytes when daily bytes budget is exceeded", async () => {
    process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = "1000000";
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "500";
    recordBytesBilled(600);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/health?type=readiness"),
    );
    const body = (await response.json()) as {
      status: string;
      checks: {
        bytesBilled: {
          status: string;
          dailyBytesBilled: number;
          dailyBytesRemaining: number;
          dailyBytesBudget: number;
          dailyBurnLine: string;
          message?: string;
        };
      };
    };
    assert.equal(body.checks.bytesBilled.status, "degraded");
    assert.equal(body.checks.bytesBilled.dailyBytesBilled, 600);
    assert.equal(body.checks.bytesBilled.dailyBytesRemaining, 0);
    assert.equal(body.checks.bytesBilled.dailyBytesBudget, 500);
    assert.ok(body.checks.bytesBilled.dailyBurnLine.includes("Daily BigQuery burn:"));
    assert.ok((body.checks.bytesBilled.message ?? "").includes("Daily BigQuery bytes budget exceeded"));
  });
});
