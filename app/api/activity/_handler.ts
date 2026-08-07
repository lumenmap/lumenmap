import { NextResponse } from "next/server";
import { metrics } from "@/lib/telemetry/metrics";
import { getActivityData } from "@/lib/hubble/activity";
import { BigQueryLimitExceededError } from "@/lib/hubble/errors";
import { hasBigQueryCredentials } from "@/lib/hubble/client";
import { buildFixtureDataset } from "@/lib/hubble/fixture";
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
import { isValidPeriod, PERIOD_OPTIONS } from "@/lib/periods";
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

export type ActivityFetcher = (period: Period) => Promise<ActivityDataset>;

const SUPPORTED_PERIODS = PERIOD_OPTIONS.map((period) => period.value);


function recordActivityResponseSize(
  period: string,
  status: "2xx" | "4xx" | "5xx",
  payload: unknown,
): void {
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
  metrics.record({ endpoint: "activity", period, status }, bytes);
}

export function parseActivityPeriod(periodParam: string | null):
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
      usdcCategories: data.usdcCategories,
      usdcAccounts: data.usdcAccounts,
    },
  };
}

export async function handleActivityRequest(
  request: Request,
  fetchActivityData: ActivityFetcher = getActivityData,
) {
  const correlationId = createCorrelationId();
  const timer = startTimer();
  const { searchParams } = new URL(request.url);
  const parsed = parseActivityPeriod(searchParams.get("period"));

  if (!parsed.ok) {
    recordActivityResponseSize(
      new URL(request.url).searchParams.get("period") ?? "",
      "4xx",
      parsed.body,
    );
    return NextResponse.json(parsed.body, { status: parsed.status });
  }

  logInfo({
    event: "activity.request.start",
    correlationId,
    period: parsed.period,
  });

  // Fixture mode is opt-in via LUMENMAP_DATA_SOURCE=fixture (blocked in production).
  // Missing GCP credentials still serve fixtures in non-production for local DX.
  const dataSource = resolveDataSource();
  const forceFixture = dataSource === "fixture";
  const allowMissingCredsFallback =
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production";
  if (
    fetchActivityData === getActivityData &&
    (forceFixture || (!hasBigQueryCredentials() && allowMissingCredsFallback))
  ) {
    const data = forceFixture
      ? getFixtureActivityData(parsed.period)
      : buildFixtureDataset(parsed.period);
    const validated = validateActivityResponse({
      ...toVisualizationResponse(data),
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
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    });
  }

  try {
    const data = await fetchActivityData(parsed.period);
    const validated = validateActivityResponse(toVisualizationResponse(data));
    logInfo({
      event: "activity.request.complete",
      correlationId,
      period: parsed.period,
      durationMs: endTimer(timer),
    });
    recordActivityResponseSize(parsed.period, "2xx", validated);
    return NextResponse.json(validated, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
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
          message: error.message,
        } satisfies ApiErrorResponse,
        { status: 400 },
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
        return NextResponse.json(body, { status: 500 });
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

    return NextResponse.json(body, { status: 500 });
  }
}

export async function handleRawActivityRequest(
  request: Request,
  fetchActivityData: ActivityFetcher = getActivityData,
) {
  const { searchParams } = new URL(request.url);
  const parsed = parseActivityPeriod(searchParams.get("period"));

  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status });
  }

  try {
    const data = await fetchActivityData(parsed.period);
    return NextResponse.json(toRawResearchResponse(data), {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    });
  } catch (error) {
    if (error instanceof BigQueryLimitExceededError) {
      return NextResponse.json(
        {
          code: "LIMIT_EXCEEDED",
          message: error.message,
        } satisfies ApiErrorResponse,
        { status: 400 },
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

    return NextResponse.json(body, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleActivityRequest(request);
}
