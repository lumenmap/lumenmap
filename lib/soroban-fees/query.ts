import { getBigQueryClient } from "@/lib/hubble/client";
import { getMaxBytesBilledLimit } from "@/lib/hubble/config";
import {
  sorobanFeeContractQuery,
  sorobanFeeSummaryQuery,
} from "@/lib/hubble/shared-queries.mjs";
import { isFixtureMode } from "@/lib/data-source";
import { classifyError } from "@/lib/log";
import { resolvePeriod } from "@/lib/periods";
import { buildSorobanFeeFixture } from "@/lib/soroban-fees/fixture";
import { mapSorobanFeeRows } from "@/lib/soroban-fees/mapper";
import {
  SOROBAN_FEE_COLUMNS,
  type SorobanFeeAnalytics,
  type SorobanFeeUnavailable,
  type SorobanFeeUnavailableReason,
} from "@/lib/soroban-fees/types";
import type { Period } from "@/lib/types";

export type SorobanFeeQueryRunner = (
  sql: string,
  params: { start: string; end: string },
) => Promise<unknown>;

const LIVE_NOTE =
  "Total fees are SUM(total_fee_charged) in stroops. Average resources per invoke are SUM(total_non_refundable_resource_fee) / SUM(txn_count). This is a stroop charge covering CPU, read bytes, write bytes, and bandwidth, not a raw instruction count. Refund and rent are not shown.";

const SCHEMA_MESSAGE =
  "Soroban fee columns are not available in the current Hubble schema. The rest of the dashboard is unaffected.";

const FAILED_MESSAGE =
  "Soroban fee analytics could not be loaded for this period. The rest of the dashboard is unaffected.";

export function sorobanFeeFailureReason(
  error: unknown,
): SorobanFeeUnavailableReason {
  return classifyError(error) === "schema" ? "schema_drift" : "query_failed";
}

export function unavailableSorobanFees(input: {
  period: Period;
  start: string;
  end: string;
  error: unknown;
}): SorobanFeeUnavailable {
  const reason = sorobanFeeFailureReason(input.error);
  return {
    status: "unavailable",
    source: "hubble",
    period: input.period,
    start: input.start,
    end: input.end,
    reason,
    message: reason === "schema_drift" ? SCHEMA_MESSAGE : FAILED_MESSAGE,
  };
}

/**
 * Run the summary and contract queries. Any failure, including a missing
 * column, becomes a typed unavailable result. This function does not throw.
 */
export async function querySorobanFeeAnalytics(input: {
  period: Period;
  start: string;
  end: string;
  runQuery: SorobanFeeQueryRunner;
}): Promise<SorobanFeeAnalytics> {
  const params = { start: input.start, end: input.end };
  try {
    const [summaryRows, contractRows] = await Promise.all([
      input.runQuery(sorobanFeeSummaryQuery, params),
      input.runQuery(sorobanFeeContractQuery, params),
    ]);
    const mapped = mapSorobanFeeRows({ summaryRows, contractRows });
    return {
      status: "available",
      source: "hubble",
      period: input.period,
      start: input.start,
      end: input.end,
      totalFeeStroops: mapped.totalFeeStroops,
      invokeCount: mapped.invokeCount,
      avgResourceStroopsPerInvoke: mapped.avgResourceStroopsPerInvoke,
      topContracts: mapped.topContracts,
      columns: SOROBAN_FEE_COLUMNS,
      note: LIVE_NOTE,
    };
  } catch (error) {
    return unavailableSorobanFees({
      period: input.period,
      start: input.start,
      end: input.end,
      error,
    });
  }
}

async function runLiveQuery(
  sql: string,
  params: { start: string; end: string },
): Promise<unknown[]> {
  const client = getBigQueryClient();
  if (!client) {
    throw new Error("BigQuery client is not configured");
  }
  const limit = getMaxBytesBilledLimit();
  const [job] = await client.createQueryJob({
    query: sql,
    params,
    maximumBytesBilled: limit.toString(),
  });
  const [rows] = await job.getQueryResults();
  return rows as unknown[];
}

/**
 * Load fee analytics for the selected period.
 * Fixture mode returns the documented sample. Live mode soft-fails.
 */
export async function loadSorobanFeeAnalytics(input: {
  period: Period;
  now?: Date;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  runQuery?: SorobanFeeQueryRunner;
}): Promise<SorobanFeeAnalytics> {
  const range = resolvePeriod(input.period, input.now ?? new Date());
  const start = range.start.toISOString();
  const end = range.end.toISOString();

  try {
    if (isFixtureMode(input.env)) {
      return buildSorobanFeeFixture({ period: input.period, start, end });
    }
  } catch (error) {
    return unavailableSorobanFees({
      period: input.period,
      start,
      end,
      error,
    });
  }

  return querySorobanFeeAnalytics({
    period: input.period,
    start,
    end,
    runQuery: input.runQuery ?? runLiveQuery,
  });
}
