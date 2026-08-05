import { NextResponse } from "next/server";
import { getActivityData } from "@/lib/hubble/activity";
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
      contracts: data.contracts,
      accounts: data.accounts,
      sorobanFunctions: data.sorobanFunctions,
      sorobanFunctionContracts: data.sorobanFunctionContracts,
    },
  };
}

export async function handleActivityRequest(
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
    const validated = validateActivityResponse(toVisualizationResponse(data));
    return NextResponse.json(validated, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    });
  } catch (error) {
    if (error instanceof ActivityResponseValidationError) {
      console.error(`[activity] ${error.diagnostic}`);
      return NextResponse.json(publicValidationErrorBody(), { status: 500 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch activity data";
    console.error("[activity] Failed to fetch activity data:", message, error);

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
