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
    budget: process.env.BIGQUERY_DAILY_BYTES_BUDGET,
    soft: process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO,
  };

  beforeEach(() => {
    resetBytesBilledTelemetry();
    delete process.env.LUMENMAP_DATA_SOURCE;
    process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES = "15";
    process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = "1000";
    process.env.BIGQUERY_DAILY_BYTES_BUDGET = "10000";
    process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO = "0.8";
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
    if (previous.budget === undefined) delete process.env.BIGQUERY_DAILY_BYTES_BUDGET;
    else process.env.BIGQUERY_DAILY_BYTES_BUDGET = previous.budget;
    if (previous.soft === undefined) delete process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO;
    else process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO = previous.soft;
  });

  it("reports zero bytes billed in fixture mode", async () => {
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
          status: string;
        };
      };
    };
    assert.equal(body.checks.bytesBilled.rollingBytesBilled, 0);
    assert.equal(body.checks.bytesBilled.status, "ok");
    assert.equal(
      (body.checks.bytesBilled as { dailyUsedBytes?: number }).dailyUsedBytes,
      0,
    );
    assert.ok(["healthy", "degraded", "unavailable"].includes(body.status));
    assert.ok(Number.isInteger(body.checks.bigquery.latencyMs));
  });

  it("soft-warns when daily budget usage crosses the soft ratio", async () => {
    process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD = "1000000";
    recordBytesBilled(8000);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/health?type=readiness"),
    );
    const body = (await response.json()) as {
      status: string;
      checks: {
        bytesBilled: {
          status: string;
          dailyUsedBytes: number;
          dailyRemainingBytes: number;
          dailyBudgetStatus: string;
          message?: string;
        };
      };
    };
    assert.equal(body.checks.bytesBilled.dailyBudgetStatus, "soft_warn");
    assert.equal(body.checks.bytesBilled.dailyUsedBytes, 8000);
    assert.equal(body.checks.bytesBilled.dailyRemainingBytes, 2000);
    assert.equal(body.checks.bytesBilled.status, "degraded");
    assert.ok((body.checks.bytesBilled.message ?? "").includes("soft"));
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
});
