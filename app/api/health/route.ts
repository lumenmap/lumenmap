import { NextResponse } from "next/server";
import {
  getBigQueryClient,
  hasBigQueryCredentials,
  isFixtureMode,
} from "@/lib/hubble/client";
import { getCached } from "@/lib/hubble/cache";
import {
  formatDailyBurnLine,
  getBytesBilledDegradedThreshold,
  getBytesBilledWindowMinutes,
  getDailyBudgetSnapshot,
  getRollingBytesBilled,
} from "@/lib/hubble/bytes-billed-telemetry";
import { getAllEntities } from "@/lib/entities/registry";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withApiTrace } from "@/lib/telemetry/tracing";

export const dynamic = "force-dynamic";

const HEALTH_CHECK_TIMEOUT_MS = 4_000;
const OK_STATUS = 200;
const UNAVAILABLE_STATUS = 503;

type CheckResult = {
  status: "ok" | "degraded" | "unavailable";
  latencyMs: number;
  message: string;
};

type BytesBilledCheckResult = CheckResult & {
  rollingBytesBilled: number;
  windowMinutes: number;
  dailyBytesUsed: number;
  dailyBytesBudget: number;
  dailyBytesRemaining: number;
  dailyBurnRatio: number;
  softThresholdExceeded: boolean;
  hardFailNonCriticalActive: boolean;
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
    const testKey = "__health_check_test__";
    getCached(testKey);

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
  const fixture = isFixtureMode();
  const budget = getDailyBudgetSnapshot(start, { fixtureMode: fixture });
  const dailyBurnLine = formatDailyBurnLine(budget);

  if (fixture) {
    return {
      status: "ok",
      latencyMs: Date.now() - start,
      message: "Fixture mode reports zero bytes billed",
      rollingBytesBilled: 0,
      windowMinutes,
      dailyBytesUsed: budget.dailyBytesUsed,
      dailyBytesBudget: budget.dailyBytesBudget,
      dailyBytesRemaining: budget.dailyBytesRemaining,
      dailyBurnRatio: budget.dailyBurnRatio,
      softThresholdExceeded: budget.softThresholdExceeded,
      hardFailNonCriticalActive: budget.hardFailNonCriticalActive,
      dailyBurnLine,
    };
  }

  const rollingBytesBilled = getRollingBytesBilled(start);
  const threshold = getBytesBilledDegradedThreshold();

  if (rollingBytesBilled > threshold || budget.softThresholdExceeded) {
    const message =
      rollingBytesBilled > threshold
        ? "Rolling BigQuery bytes billed exceeded configured threshold"
        : budget.budgetExceeded
          ? "Daily BigQuery cost budget exceeded"
          : "Daily BigQuery bytes burn exceeded soft warning threshold";
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      message,
      rollingBytesBilled,
      windowMinutes,
      dailyBytesUsed: budget.dailyBytesUsed,
      dailyBytesBudget: budget.dailyBytesBudget,
      dailyBytesRemaining: budget.dailyBytesRemaining,
      dailyBurnRatio: budget.dailyBurnRatio,
      softThresholdExceeded: budget.softThresholdExceeded,
      hardFailNonCriticalActive: budget.hardFailNonCriticalActive,
      dailyBurnLine,
    };
  }

  return {
    status: "ok",
    latencyMs: Date.now() - start,
    message: "Rolling BigQuery bytes billed within threshold",
    rollingBytesBilled,
    windowMinutes,
    dailyBytesUsed: budget.dailyBytesUsed,
    dailyBytesBudget: budget.dailyBytesBudget,
    dailyBytesRemaining: budget.dailyBytesRemaining,
    dailyBurnRatio: budget.dailyBurnRatio,
    softThresholdExceeded: budget.softThresholdExceeded,
    hardFailNonCriticalActive: budget.hardFailNonCriticalActive,
    dailyBurnLine,
  };
}

async function handleHealthRequest(request: Request) {
  const limited = enforceRateLimit(request, "health");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "readiness";

  if (type === "liveness") {
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  }

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
          dailyBytesUsed: bytesBilled.dailyBytesUsed,
          dailyBytesBudget: bytesBilled.dailyBytesBudget,
          dailyBytesRemaining: bytesBilled.dailyBytesRemaining,
          dailyBurnRatio: bytesBilled.dailyBurnRatio,
          softThresholdExceeded: bytesBilled.softThresholdExceeded,
          hardFailNonCriticalActive: bytesBilled.hardFailNonCriticalActive,
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
