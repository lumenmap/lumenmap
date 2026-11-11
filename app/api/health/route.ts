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
  getDailyBurnSummary,
  getRollingBytesBilled,
} from "@/lib/hubble/bytes-billed-telemetry";
import { getAllEntities } from "@/lib/entities/registry";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withApiTrace } from "@/lib/telemetry/tracing";

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
  dailyBytesBilled: number;
  dailyBytesRemaining: number;
  dailyBytesBudget: number;
  dailyBurnPercent: number;
  softWarnPercent: number;
  dailyBurnLine: string;
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
  const dailySummary = getDailyBurnSummary();

  if (isFixtureMode()) {
    return {
      status: "ok",
      latencyMs: Date.now() - start,
      message: "Fixture mode reports zero bytes billed",
      rollingBytesBilled: 0,
      windowMinutes,
      dailyBytesBilled: 0,
      dailyBytesRemaining: dailySummary.dailyBytesBudget,
      dailyBytesBudget: dailySummary.dailyBytesBudget,
      dailyBurnPercent: 0,
      softWarnPercent: dailySummary.softWarnPercent,
      dailyBurnLine: "Daily BigQuery burn: 0.00 GB (fixture mode)",
    };
  }

  const rollingBytesBilled = getRollingBytesBilled();
  const threshold = getBytesBilledDegradedThreshold();

  if (dailySummary.isExceeded) {
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      message: "Daily BigQuery bytes budget exceeded configured guardrail",
      rollingBytesBilled,
      windowMinutes,
      dailyBytesBilled: dailySummary.dailyBytesBilled,
      dailyBytesRemaining: dailySummary.dailyBytesRemaining,
      dailyBytesBudget: dailySummary.dailyBytesBudget,
      dailyBurnPercent: dailySummary.utilizationPercent,
      softWarnPercent: dailySummary.softWarnPercent,
      dailyBurnLine: dailySummary.formattedLine,
    };
  }

  if (dailySummary.isSoftWarning) {
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      message: `Daily BigQuery bytes burn exceeded soft warning threshold (${dailySummary.softWarnPercent}%)`,
      rollingBytesBilled,
      windowMinutes,
      dailyBytesBilled: dailySummary.dailyBytesBilled,
      dailyBytesRemaining: dailySummary.dailyBytesRemaining,
      dailyBytesBudget: dailySummary.dailyBytesBudget,
      dailyBurnPercent: dailySummary.utilizationPercent,
      softWarnPercent: dailySummary.softWarnPercent,
      dailyBurnLine: dailySummary.formattedLine,
    };
  }

  if (rollingBytesBilled > threshold) {
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      message: "Rolling BigQuery bytes billed exceeded configured threshold",
      rollingBytesBilled,
      windowMinutes,
      dailyBytesBilled: dailySummary.dailyBytesBilled,
      dailyBytesRemaining: dailySummary.dailyBytesRemaining,
      dailyBytesBudget: dailySummary.dailyBytesBudget,
      dailyBurnPercent: dailySummary.utilizationPercent,
      softWarnPercent: dailySummary.softWarnPercent,
      dailyBurnLine: dailySummary.formattedLine,
    };
  }

  return {
    status: "ok",
    latencyMs: Date.now() - start,
    message: "Rolling BigQuery bytes billed within threshold",
    rollingBytesBilled,
    windowMinutes,
    dailyBytesBilled: dailySummary.dailyBytesBilled,
    dailyBytesRemaining: dailySummary.dailyBytesRemaining,
    dailyBytesBudget: dailySummary.dailyBytesBudget,
    dailyBurnPercent: dailySummary.utilizationPercent,
    softWarnPercent: dailySummary.softWarnPercent,
    dailyBurnLine: dailySummary.formattedLine,
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

  return NextResponse.json(
    {
      status: aggregateStatus,
      timestamp: new Date().toISOString(),
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
          dailyBytesBilled: bytesBilled.dailyBytesBilled,
          dailyBytesRemaining: bytesBilled.dailyBytesRemaining,
          dailyBytesBudget: bytesBilled.dailyBytesBudget,
          dailyBurnPercent: bytesBilled.dailyBurnPercent,
          softWarnPercent: bytesBilled.softWarnPercent,
          dailyBurnLine: bytesBilled.dailyBurnLine,
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
