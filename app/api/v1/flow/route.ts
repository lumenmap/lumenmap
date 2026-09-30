import { NextResponse } from "next/server";
import { getFlowEdges, type FlowAssetMode } from "@/lib/hubble/flow";
import { BigQueryLimitExceededError } from "@/lib/hubble/errors";
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
} from "@/lib/network";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { ApiErrorResponse } from "@/lib/types";

const SUPPORTED_ASSET_MODES: FlowAssetMode[] = ["xlm", "usdc", "op_count"];

function parseAssetMode(
  assetModeParam: string | null,
): { ok: true; assetMode: FlowAssetMode } | { ok: false; body: ApiErrorResponse; status: number } {
  if (assetModeParam === null) {
    return { ok: true, assetMode: "op_count" };
  }

  if (!SUPPORTED_ASSET_MODES.includes(assetModeParam as FlowAssetMode)) {
    return {
      ok: false,
      body: {
        code: "INVALID_ASSET_MODE",
        message: "Unsupported asset mode. Use xlm, usdc, or op_count.",
        supported: SUPPORTED_ASSET_MODES,
      },
      status: 400,
    };
  }

  return { ok: true, assetMode: assetModeParam as FlowAssetMode };
}

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "v1");
  if (limited) return limited;

  const correlationId = createCorrelationId();
  const timer = startTimer();
  const { searchParams } = new URL(request.url);

  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const networkParam = searchParams.get("network");
  const assetModeParsed = parseAssetMode(searchParams.get("assetMode"));

  if (!start || !end) {
    const body: ApiErrorResponse = {
      code: "MISSING_PARAMS",
      message: "start and end parameters are required (ISO 8601 timestamps).",
    };
    logError({
      event: "flow.request.error",
      correlationId,
      durationMs: endTimer(timer),
      errorClass: "validation",
      errorMessage: "Missing start or end parameter",
    });
    return NextResponse.json(body, { status: 400 });
  }

  if (networkParam !== null && !isDashboardNetworkId(networkParam)) {
    const body: ApiErrorResponse = {
      code: "INVALID_NETWORK",
      message: "Unsupported network. Use mainnet or testnet.",
      supported: ["mainnet", "testnet"],
    };
    logError({
      event: "flow.request.error",
      correlationId,
      durationMs: endTimer(timer),
      errorClass: "validation",
      errorMessage: "Invalid network parameter",
    });
    return NextResponse.json(body, { status: 400 });
  }
  const network = resolveDashboardNetwork(networkParam);

  if (!assetModeParsed.ok) {
    logError({
      event: "flow.request.error",
      correlationId,
      durationMs: endTimer(timer),
      errorClass: "validation",
      errorMessage: assetModeParsed.body.message,
    });
    return NextResponse.json(assetModeParsed.body, { status: assetModeParsed.status });
  }

  logInfo({
    event: "flow.request.start",
    correlationId,
    start,
    end,
    assetMode: assetModeParsed.assetMode,
    network,
  });

  try {
    const data = await getFlowEdges(
      start,
      end,
      assetModeParsed.assetMode,
      correlationId,
      network,
    );

    logInfo({
      event: "flow.request.complete",
      correlationId,
      durationMs: endTimer(timer),
      edgeCount: data.edges.length,
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch (error) {
    if (error instanceof BigQueryLimitExceededError) {
      logError({
        event: "flow.request.error",
        correlationId,
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

    const message =
      error instanceof Error ? error.message : "Failed to fetch flow edges";
    console.error("[flow] Failed to fetch flow edges:", message, error);
    logError({
      event: "flow.request.error",
      correlationId,
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
