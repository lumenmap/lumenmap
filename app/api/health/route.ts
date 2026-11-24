import { NextResponse } from "next/server";
import {
  getBigQueryClient,
  hasBigQueryCredentials,
  isFixtureMode,
} from "@/lib/hubble/client";
import { getCached } from "@/lib/hubble/cache";
import {
  getBytesBilledDegradedThreshold,
  getBytesBilledWindowMinutes,
  getRollingBytesBilled,
} from "@/lib/hubble/bytes-billed-telemetry";
import { getDailyBudgetSnapshot } from "@/lib/hubble/bytes-budget";
import { getAllEntities } from "@/lib/entities/registry";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withApiTrace } from "@/lib/telemetry/tracing";
import {
  buildHorizonFallbackReport,
  isHorizonFallbackEnabled,
  readHorizonMock,
} from "@/lib/horizon/fallback";

export const dynamic = "force-dynamic";

/**
 * Health check configuration.
 *
 * ## Liveness vs Readiness
 *
 * - **Liveness** (`/api/health?type=liveness`): Is the application process running?
 *   Always returns healthy if the route responds. Use for process-level probes.
 *
 * - **Readiness** (`/api/health?type=readiness` or no type): Is the application
 *   ready to serve traffic? Verifies upstream dependencies (BigQuery, data files).
 *   Use for load-balancer / ingress probes. This is the default.
 *
 * ## Status codes
 *
 * - `200` – healthy (all checks pass) or degraded (partial upstream failures)
 * - `503` – unavailable (critical dependency failure)
 *
 * ## Probe safety
 *
 * - Every upstream check has a strict low-cost timeout.
 * - No full activity queries are executed.
 * - The response never exposes credentials, raw provider errors, or project IDs.
 */

const HEALTH_CHECK_TIMEOUT_MS = 4_000;
const OK_STATUS = 200;
const UNAVAILABLE_STATUS = 503;

// ── Check helpers ──────────────────────────────────────────────────────────

type CheckResult = {
  status: "ok" | "degraded" | "unavailable";
  latencyMs: number;
  message: string;
};

type BytesBilledCheckResult = CheckResult & {
  rollingBytesBilled: number;
  windowMinutes: number;
  dailyBudgetBytes: number;
  dailyUsedBytes: number;
  dailyRemainingBytes: number;
  dailyBudgetStatus: "ok" | "soft_warn" | "over";
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<{ result: T | null; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    return { result, timedOut: false };
  } catch (err) {
    if (err instanceof Error && err.message === "TIMEOUT") {
      return { result: null, timedOut: true };
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkBigQuery(): Promise<CheckResult> {
  const start = Date.now();

  if (!hasBigQueryCredentials()) {
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      message: "BigQuery credentials are not configured",
    };
  }

  const client = getBigQueryClient();
  if (!client) {
    return {
      status: "unavailable",
      latencyMs: Date.now() - start,
      message: "Failed to initialize BigQuery client",
    };
  }

  try {
    const { timedOut } = await withTimeout(
      client.query({ query: "SELECT 1 AS ok", useLegacySql: false }),
      HEALTH_CHECK_TIMEOUT_MS,
    );

    if (timedOut) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        message: "BigQuery ping timed out",
      };
    }

    return {
      status: "ok",
      latencyMs: Date.now() - start,
      message: "BigQuery responded",
    };
  } catch {
    return {
      status: "unavailable",
      latencyMs: Date.now() - start,
      message: "BigQuery ping failed",
    };
  }
}

async function checkDataFiles(): Promise<CheckResult> {
  const start = Date.now();

  try {
    const count = Object.keys(getAllEntities()).length;

    if (count === 0) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        message: "Entity registry loaded but contains no entries",
      };
    }

    return {
      status: "ok",
      latencyMs: Date.now() - start,
      message: `Entity data files loaded (${count} entries)`,
    };
  } catch {
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      message: "Entity data files failed to load",
    };
  }
}

function checkCache(): CheckResult {
  const start = Date.now();

  try {
    // Verify the cache Map is reachable by reading a non-existent key.
    // If this runs without throwing, the cache is operational.
    const testKey = "__health_check_test__";
    getCached(testKey); // reads (returns null — expected)

    return {
      status: "ok",
      latencyMs: Date.now() - start,
      message: "Cache is operational",
    };
  } catch {
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      message: "Cache check failed",
    };
  }
}

function checkBytesBilled(): BytesBilledCheckResult {
  const start = Date.now();
  const windowMinutes = getBytesBilledWindowMinutes();
  const budget = getDailyBudgetSnapshot();

  if (isFixtureMode()) {
    return {
      status: "ok",
      latencyMs: Date.now() - start,
      message: "Fixture mode reports zero bytes billed",
      rollingBytesBilled: 0,
      windowMinutes,
      dailyBudgetBytes: budget.budgetBytes,
      dailyUsedBytes: 0,
      dailyRemainingBytes: budget.budgetBytes,
      dailyBudgetStatus: "ok",
    };
  }

  const rollingBytesBilled = getRollingBytesBilled();
  const threshold = getBytesBilledDegradedThreshold();
  const budgetDegraded = budget.status !== "ok";
  const rollingDegraded = rollingBytesBilled > threshold;

  if (rollingDegraded || budgetDegraded) {
    const parts: string[] = [];
    if (rollingDegraded) {
      parts.push("Rolling BigQuery bytes billed exceeded configured threshold");
    }
    if (budget.status === "soft_warn") {
      parts.push("Daily BigQuery bytes budget soft threshold reached");
    } else if (budget.status === "over") {
      parts.push("Daily BigQuery bytes budget exceeded");
    }
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      message: parts.join("; "),
      rollingBytesBilled,
      windowMinutes,
      dailyBudgetBytes: budget.budgetBytes,
      dailyUsedBytes: budget.usedBytes,
      dailyRemainingBytes: budget.remainingBytes,
      dailyBudgetStatus: budget.status,
    };
  }

  return {
    status: "ok",
    latencyMs: Date.now() - start,
    message: "Rolling BigQuery bytes billed within threshold",
    rollingBytesBilled,
    windowMinutes,
    dailyBudgetBytes: budget.budgetBytes,
    dailyUsedBytes: budget.usedBytes,
    dailyRemainingBytes: budget.remainingBytes,
    dailyBudgetStatus: budget.status,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

async function handleHealthRequest(request: Request) {
  const limited = enforceRateLimit(request, "health");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "readiness";

  // Liveness: only confirm the process is alive.
  if (type === "liveness") {
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  }

  // Readiness: run upstream dependency checks.
  const [bq, data, cache] = await Promise.all([
    checkBigQuery(),
    checkDataFiles(),
    checkCache(),
  ]);
  const bytesBilled = checkBytesBilled();

  const checks = {
    bigquery: bq,
    dataFiles: data,
    cache,
    bytesBilled,
  };
  const anyUnavailable = Object.values(checks).some(
    (c) => c.status === "unavailable",
  );
  const anyDegraded = Object.values(checks).some(
    (c) => c.status === "degraded",
  );

  const aggregateStatus = anyUnavailable
    ? "unavailable"
    : anyDegraded
      ? "degraded"
      : "healthy";

  // Fallback is a read-path label. It does not change the aggregate status.
  const fallback = buildHorizonFallbackReport({
    flagEnabled: isHorizonFallbackEnabled(),
    hubbleStatus: bq.status,
    horizonSample: readHorizonMock(),
  });

  return NextResponse.json(
    {
      status: aggregateStatus,
      timestamp: new Date().toISOString(),
      fallback,
      checks: {
        bigquery: {
          status: bq.status,
          latencyMs: bq.latencyMs,
          message: bq.status !== "ok" ? bq.message : undefined,
        },
        dataFiles: {
          status: data.status,
          latencyMs: data.latencyMs,
          message: data.status !== "ok" ? data.message : undefined,
        },
        cache: {
          status: cache.status,
          latencyMs: cache.latencyMs,
          message: cache.status !== "ok" ? cache.message : undefined,
        },
        bytesBilled: {
          status: bytesBilled.status,
          latencyMs: bytesBilled.latencyMs,
          rollingBytesBilled: bytesBilled.rollingBytesBilled,
          windowMinutes: bytesBilled.windowMinutes,
          dailyBudgetBytes: bytesBilled.dailyBudgetBytes,
          dailyUsedBytes: bytesBilled.dailyUsedBytes,
          dailyRemainingBytes: bytesBilled.dailyRemainingBytes,
          dailyBudgetStatus: bytesBilled.dailyBudgetStatus,
          message:
            bytesBilled.status !== "ok" ? bytesBilled.message : undefined,
        },
      },
    },
    {
      status:
        aggregateStatus === "unavailable"
          ? UNAVAILABLE_STATUS
          : OK_STATUS,
    },
  );
}

export const GET = withApiTrace("/api/health", handleHealthRequest);
