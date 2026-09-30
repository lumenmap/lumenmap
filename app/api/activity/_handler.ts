import { NextResponse } from "next/server";
import { metrics } from "@/lib/telemetry/metrics";
import { getActivityData } from "@/lib/hubble/activity";
import { BigQueryLimitExceededError } from "@/lib/hubble/errors";
import { resolveDataSource } from "@/lib/data-source";
import { getFixtureActivityData } from "@/lib/fixtures/activity";
import {
  classifyError,
  createCorrelationId,
  endTimer,
  logError,
  logInfo,
  startTimer,
} from "@/lib/log";
import {
  isDashboardNetworkId,
  resolveDashboardNetwork,
  type DashboardNetworkId,
} from "@/lib/network";
import { isValidPeriod, PERIOD_OPTIONS } from "@/lib/periods";
import { NO_STORE_HEADERS, activityCacheHeaders } from "@/lib/http/cache-headers";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  ActivityResponseValidationError,
  publicValidationErrorBody,
  validateActivityResponse,
} from "@/lib/schemas/validate-activity-response";
import type {
  ActivityDataset,
  ActivityRawResearchResponse,
  ActivityVisualizationResponse,
  ApiErrorResponse,
  Period,
} from "@/lib/types";

export type ActivityFetcher = (
  period: Period,
  correlationId?: string,
  network?: DashboardNetworkId,
) => Promise<ActivityDataset>;

const SUPPORTED_PERIODS = PERIOD_OPTIONS.map((period) => period.value);

function recordActivityResponseSize(
  period: string,
  status: "2xx" | "4xx" | "5xx",
  payload: unknown,
): void {
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
  metrics.record({ endpoint: "activity", period, status }, bytes);
}

export function parseActivityPeriod(
  periodParam: string | null,
):
  | { ok: true; period: Period }
  | { ok: false; body: ApiErrorResponse; status: 400 } {
  if (periodParam === null) {
    return { ok: true, period: "1d" };
  }

  if (!isValidPeriod(periodParam)) {
    return {
      ok: false,
      body: {
        code: "INVALID_PERIOD",
        message: "Unsupported activity period.",
        supported: SUPPORTED_PERIODS,
      },
      status: 400,
    };
  }

  return { ok: true, period: periodParam };
}

export function toVisualizationResponse(
  data: ActivityDataset,
): ActivityVisualizationResponse {
  return {
    period: data.period,
    start: data.start,
    end: data.end,
    source: data.source,
    sourceTimestamp: data.sourceTimestamp,
    isPeriodComplete: data.isPeriodComplete,
    kpis: data.kpis,
    treemaps: data.treemaps,
    protocols: data.protocols,
    timeseries: data.timeseries,
    heatmap: data.heatmap,
    assetVolumes: data.assetVolumes,
    metricProvenance: data.metricProvenance,
  };
}

export function toRawResearchResponse(
  data: ActivityDataset,
): ActivityRawResearchResponse {
  return {
    period: data.period,
    start: data.start,
    end: data.end,
    source: data.source,
    sourceTimestamp: data.sourceTimestamp,
    isPeriodComplete: data.isPeriodComplete,
    rows: {
      categories: data.categories,
      transactionCategories: data.transactionCategories,
      contracts: data.contracts,
      accounts: data.accounts,
      sorobanFunctions: data.sorobanFunctions,
      sorobanFunctionContracts: data.sorobanFunctionContracts,
      usdcPaymentVolume: data.usdcPaymentVolume,
      assetVolumes: data.assetVolumes,
      usdcCategories: data.usdcCategories,
      usdcAccounts: data.usdcAccounts,
    },
  };
}

export async function handleActivityRequest(
  request: Request,
  fetchActivityData: ActivityFetcher = getActivityData,
) {
  const limited = enforceRateLimit(request, "v1");
  if (limited) return limited;

  const correlationId = createCorrelationId();
  const timer = startTimer();
  const { searchParams } = new URL(request.url);
  const parsed = parseActivityPeriod(searchParams.get("period"));
  const networkParam = searchParams.get("network");
  if (networkParam !== null && !isDashboardNetworkId(networkParam)) {
    const body: ApiErrorResponse = {
      code: "INVALID_NETWORK",
      message: "Unsupported network. Use mainnet or testnet.",
      supported: ["mainnet", "testnet"],
    };
    recordActivityResponseSize(networkParam, "4xx", body);
    return NextResponse.json(body, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }
  const network = resolveDashboardNetwork(networkParam);

  if (!parsed.ok) {
    recordActivityResponseSize(
      new URL(request.url).searchParams.get("period") ?? "",
      "4xx",
      parsed.body,
    );
    return NextResponse.json(parsed.body, {
      status: parsed.status,
      headers: NO_STORE_HEADERS,
    });
  }

  logInfo({
    event: "activity.request.start",
    correlationId,
    period: parsed.period,
  });

  // Fixture mode is opt-in only (LUMENMAP_DATA_SOURCE=fixture) and blocked in production.
  let dataSourceMode: "live" | "fixture" = "live";
  try {
    dataSourceMode = resolveDataSource();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError({
      event: "activity.request.error",
      correlationId,
      period: parsed.period,
      durationMs: endTimer(timer),
      errorClass: "validation",
      errorMessage: message,
    });
    return NextResponse.json(
      { code: "INVALID_DATA_SOURCE", message },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (fetchActivityData === getActivityData && dataSourceMode === "fixture") {
    const data = getFixtureActivityData(parsed.period, network);
    const validated = validateActivityResponse({
      ...toVisualizationResponse(data),
      source: "fixture",
      fixture: true,
    });
    logInfo({
      event: "activity.request.complete",
      correlationId,
      period: parsed.period,
      durationMs: endTimer(timer),
    });
    recordActivityResponseSize(parsed.period, "2xx", validated);
    return NextResponse.json(validated, {
      headers: activityCacheHeaders({
        isPeriodComplete: validated.isPeriodComplete,
      }),
    });
  }

  try {
    const data = await fetchActivityData(parsed.period, correlationId, network);
    const validated = validateActivityResponse(toVisualizationResponse(data));
    logInfo({
      event: "activity.request.complete",
      correlationId,
      period: parsed.period,
      durationMs: endTimer(timer),
    });
    recordActivityResponseSize(parsed.period, "2xx", validated);
    return NextResponse.json(validated, {
      headers: activityCacheHeaders({
        isPeriodComplete: validated.isPeriodComplete,
      }),
    });
  } catch (error) {
    if (error instanceof BigQueryLimitExceededError) {
      logError({
        event: "activity.request.error",
        correlationId,
        period: parsed.period,
        durationMs: endTimer(timer),
        errorClass: "provider",
        errorMessage: error.message,
      });
      return NextResponse.json(
        {
          code: "LIMIT_EXCEEDED",
          message: "Query scan budget exceeded. Please narrow the time range or filters to reduce data usage.",
        } satisfies ApiErrorResponse,
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (error instanceof ActivityResponseValidationError) {
      console.error(`[activity] ${error.diagnostic}`);
      logError({
        event: "activity.request.error",
        correlationId,
        period: parsed.period,
        durationMs: endTimer(timer),
        errorClass: "validation",
        errorMessage: error.diagnostic,
      });
      {
        const body = publicValidationErrorBody();
        recordActivityResponseSize(parsed.period, "5xx", body);
        return NextResponse.json(body, {
          status: 500,
          headers: NO_STORE_HEADERS,
        });
      }
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch activity data";
    console.error("[activity] Failed to fetch activity data:", message, error);
    logError({
      event: "activity.request.error",
      correlationId,
      period: parsed.period,
      durationMs: endTimer(timer),
      errorClass: classifyError(error),
      errorMessage: message,
    });

    const body: ApiErrorResponse = {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    };

    return NextResponse.json(body, {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }
}

export async function handleRawActivityRequest(
  request: Request,
  fetchActivityData: ActivityFetcher = getActivityData,
) {
  const limited = enforceRateLimit(request, "v1");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = parseActivityPeriod(searchParams.get("period"));

  if (!parsed.ok) {
    return NextResponse.json(parsed.body, {
      status: parsed.status,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const data = await fetchActivityData(parsed.period);
    return NextResponse.json(toRawResearchResponse(data), {
      headers: activityCacheHeaders({ isPeriodComplete: data.isPeriodComplete }),
    });
  } catch (error) {
    if (error instanceof BigQueryLimitExceededError) {
      return NextResponse.json(
        {
          code: "LIMIT_EXCEEDED",
          message: "Query scan budget exceeded. Please narrow the time range or filters to reduce data usage.",
        } satisfies ApiErrorResponse,
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch activity data";
    console.error(
      "[activity/raw] Failed to fetch activity data:",
      message,
      error,
    );

    const body: ApiErrorResponse = {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    };

    return NextResponse.json(body, {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }
}

export async function GET(request: Request) {
  return handleActivityRequest(request);
}
