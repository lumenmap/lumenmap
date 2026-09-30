import {
  getBigQueryClient,
  hasBigQueryCredentials,
} from "@/lib/hubble/client";
import { getMaxBytesBilledLimit } from "@/lib/hubble/config";
import {
  extractTotalBytesBilled,
  recordBytesBilled,
} from "@/lib/hubble/bytes-billed-telemetry";
import {
  BigQueryLimitExceededError,
  isBytesBilledLimitExceededError,
} from "@/lib/hubble/errors";
import {
  flowEdgeQuery,
  getUsdcPaymentVolumeParams,
  mapFlowEdgeRows,
  type FlowEdgeRow,
} from "@/lib/hubble/queries";
import {
  isTestnetDatasetConfigured,
  type DashboardNetworkId,
} from "@/lib/network";
import {
  classifyError,
  createCorrelationId,
  endTimer,
  logError,
  logInfo,
  startTimer,
} from "@/lib/log";

export type FlowAssetMode = "xlm" | "usdc" | "op_count";

export interface FlowEdgeData {
  edges: FlowEdgeRow[];
  period: string;
  start: string;
  end: string;
  assetMode: FlowAssetMode;
  source: "hubble" | "fixture";
}

async function runQuery<T>(
  name: string,
  query: string,
  params: Record<string, unknown>,
  correlationId: string,
): Promise<T[]> {
  const timer = startTimer();

  logInfo({
    event: "flow.query.start",
    correlationId,
    queryName: name,
  });

  const client = getBigQueryClient();
  if (!client) {
    const errorMsg = "BigQuery client is not configured";
    logError({
      event: "flow.query.error",
      correlationId,
      queryName: name,
      durationMs: endTimer(timer),
      errorClass: "validation",
      errorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  const limit = getMaxBytesBilledLimit();

  try {
    const [job] = await client.createQueryJob({
      query,
      params,
      maximumBytesBilled: limit.toString(),
    });
    const [rows] = await job.getQueryResults();

    let bytesBilled = 0;
    try {
      const [metadata] = await job.getMetadata();
      bytesBilled = extractTotalBytesBilled(metadata);
    } catch {
      bytesBilled = 0;
    }
    recordBytesBilled(bytesBilled);

    logInfo({
      event: "flow.query.complete",
      correlationId,
      queryName: name,
      durationMs: endTimer(timer),
      rowCount: (rows as unknown[]).length,
      bytesBilled,
    });

    return rows as T[];
  } catch (error) {
    if (isBytesBilledLimitExceededError(error)) {
      logError({
        event: "flow.query.error",
        correlationId,
        queryName: name,
        durationMs: endTimer(timer),
        errorClass: "provider",
        errorMessage: `BigQuery bytes billed limit exceeded (limit=${limit})`,
      });
      console.error(
        `BigQuery query limit exceeded (Limit: ${limit} bytes):\n` +
          `Query: ${query.trim().replace(/\s+/g, " ")}\n` +
          `Params: ${JSON.stringify(params)}`,
      );
      throw new BigQueryLimitExceededError(
        "Query scan budget exceeded. Please narrow the time range or filters to reduce data usage.",
        limit,
        query,
        params,
        error instanceof Error ? error : undefined,
      );
    }

    const errorClass = classifyError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    logError({
      event: "flow.query.error",
      correlationId,
      queryName: name,
      durationMs: endTimer(timer),
      errorClass,
      errorMessage,
    });

    throw error;
  }
}

export async function getFlowEdges(
  start: string,
  end: string,
  assetMode: FlowAssetMode,
  correlationId: string = createCorrelationId(),
  network: DashboardNetworkId = "mainnet",
): Promise<FlowEdgeData> {
  if (!hasBigQueryCredentials()) {
    throw new Error(
      "BigQuery credentials are required. Set GOOGLE_APPLICATION_CREDENTIALS in .env.local",
    );
  }

  if (!isTestnetDatasetConfigured(network)) {
    throw new Error(
      "Testnet BigQuery dataset is not configured. Set LUMENMAP_TESTNET_BIGQUERY_DATASET.",
    );
  }

  const params: Record<string, unknown> = { start, end, assetMode };
  
  if (assetMode === "usdc") {
    params.assets = getUsdcPaymentVolumeParams();
  }

  const rows = await runQuery<Record<string, unknown>>(
    "flowEdge",
    flowEdgeQuery,
    params,
    correlationId,
  );

  return {
    edges: mapFlowEdgeRows(rows),
    period: "custom",
    start,
    end,
    assetMode,
    source: "hubble",
  };
}
