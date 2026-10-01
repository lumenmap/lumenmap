import { getBigQueryClient } from "@/lib/hubble/client";
import { getCached, setCache } from "@/lib/hubble/cache";
import { getMaxBytesBilledLimit } from "@/lib/hubble/config";
import {
  extractTotalBytesBilled,
  recordBytesBilled,
} from "@/lib/hubble/bytes-billed-telemetry";
import {
  BigQueryLimitExceededError,
  isBytesBilledLimitExceededError,
} from "@/lib/hubble/errors";
import { coalesceInflight } from "@/lib/hubble/inflight";
import { runOptionalQuery } from "@/lib/hubble/soft-fail";
import {
  accountQuery,
  assetPaymentVolumeQuery,
  accountMetadataQuery,
  activeContractCountQuery,
  activeDestinationCountQuery,
  activeSourceAccountsQuery,
  categoryQuery,
  contractQuery,
  dailyTimeseriesQuery,
  getDestinationQueryTypes,
  hourlyTimeseriesQuery,
  heatmapQuery,
  getAccountQueryTypes,
  getUsdcPaymentVolumeParams,
  latestDataTimestampQuery,
  mapAccountMetadataRows,
  mapAccountRows,
  mapAssetPaymentVolumeRows,
  mapActiveContractCountRow,
  mapActiveDestinationCountRow,
  mapActiveSourceAccountsRows,
  mapCategoryRows,
  mapContractRows,
  mapSorobanFunctionContractRows,
  mapSorobanFunctionRows,
  mapTransactionCategoryRows,
  mapTimeseriesRows,
  mapHeatmapRows,
  mapUsdcAccountRows,
  mapUsdcCategoryRows,
  mapUsdcPaymentVolumeRows,
  sorobanFunctionContractQuery,
  sorobanFunctionQuery,
  transactionCategoryQuery,
  usdcAccountQuery,
  usdcCategoryQuery,
  usdcPaymentVolumeQuery,
  type RawQueryResults,
} from "@/lib/hubble/queries";
import { hasBigQueryCredentials } from "@/lib/hubble/client";
import {
  isTestnetDatasetConfigured,
  type DashboardNetworkId,
} from "@/lib/network";
import {
  buildAllTreemaps,
  buildKpis,
  buildProtocolSummary,
} from "@/lib/entities/build-treemap";
import {
  collectTreemapIds,
  homeDomainsToEntities,
  resolveEntityLabels,
} from "@/lib/entities/resolve-labels";
import { resolvePeriod } from "@/lib/periods";
import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import {
  fetchProtocolTvlResults,
  PROTOCOL_TVL_FIXTURE_RESULTS,
} from "@/lib/tvl/protocol-registry";
import type { TvlAdapterResult } from "@/lib/tvl/adapter";
import type {
  ActiveContractCountRow,
  ActivityDataset,
  Period,
  ActivityTimeseries,
  ActivityHeatmap,
  HeatmapBucket,
  HeatmapRawRow,
  TimeseriesBucket,
  TimeseriesRawRow,
} from "@/lib/types";
import {
  classifyError,
  createCorrelationId,
  endTimer,
  logError,
  logInfo,
  startTimer,
} from "@/lib/log";

const inflightActivityRequests = new Map<string, Promise<ActivityDataset>>();

async function runQuery<T>(
  name: string,
  query: string,
  params: Record<string, unknown>,
  correlationId: string,
): Promise<T[]> {
  const timer = startTimer();

  logInfo({
    event: "activity.query.start",
    correlationId,
    queryName: name,
  });

  const client = getBigQueryClient();
  if (!client) {
    const errorMsg = "BigQuery client is not configured";
    logError({
      event: "activity.query.error",
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
      event: "activity.query.complete",
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
        event: "activity.query.error",
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
      event: "activity.query.error",
      correlationId,
      queryName: name,
      durationMs: endTimer(timer),
      errorClass,
      errorMessage,
    });

    throw error;
  }
}

async function fetchFromHubble(
  start: string,
  end: string,
  correlationId: string,
  period: Period,
): Promise<RawQueryResults> {
  const params = { start, end };
  const timeseriesQuery =
    period === "1d" ? hourlyTimeseriesQuery : dailyTimeseriesQuery;

  /**
   * Query classification for soft failure handling.
   *
   * **Required queries:** Failure causes HTTP 500. The treemap cannot render
   * without these foundational metrics.
   * - assetPaymentVolume, category, contract, account, sorobanFunction,
   *   sorobanFunctionContract, activeSourceAccounts, timeseries, heatmap
   *
   * **Optional queries:** Failure returns null/empty with structured logs.
   * Treemap renders with degraded KPIs and metric breakdowns.
   * - transactionCategory: If fails, treemap loses txn_events/txn_actors views
   * - usdcCategory, usdcAccount: If fails, USDC treemaps show empty
   * - activeDestinationCount: If fails, active destination KPI card shows 0
   * - activeContractCount: If fails, active contract KPI card shows 0
   * - accountMetadata: If fails, home_domain labels are unavailable
   *
   * Optional queries use runOptionalQuery, which logs query failures as
   * activity.query.soft_fail and records telemetry without throwing.
   * See lib/hubble/soft-fail.ts for details.
   */

  const [
    assetVolumeRows,
    categoryRows,
    transactionCategoryRows,
    contractRows,
    accountRows,
    destinationAccountRows,
    sorobanFunctionRows,
    sorobanFunctionContractRows,
    activeSourceAccountRows,
    activeDestinationCountRows,
    usdcPaymentVolumeRows,
    usdcCategoryRows,
    usdcAccountRows,
    timeseriesRows,
    heatmapRows,
  ] = await Promise.all([
    runQuery<Record<string, unknown>>(
      "assetPaymentVolume",
      assetPaymentVolumeQuery,
      params,
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "category",
      categoryQuery,
      params,
      correlationId,
    ),
    runOptionalQuery(
      "transactionCategory",
      () =>
        runQuery<Record<string, unknown>>(
          "transactionCategory",
          transactionCategoryQuery,
          params,
          correlationId,
        ),
      () => [] as Record<string, unknown>[],
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "contract",
      contractQuery,
      params,
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "account",
      accountQuery,
      {
        ...params,
        types: getAccountQueryTypes(),
      },
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "destinationAccount",
      destinationAccountQuery,
      {
        ...params,
        types: getDestinationQueryTypes(),
      },
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "sorobanFunction",
      sorobanFunctionQuery,
      params,
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "sorobanFunctionContract",
      sorobanFunctionContractQuery,
      params,
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "activeSourceAccounts",
      activeSourceAccountsQuery,
      params,
      correlationId,
    ),
    runOptionalQuery(
      "activeDestinationCount",
      () =>
        runQuery<Record<string, unknown>>(
          "activeDestinationCount",
          activeDestinationCountQuery,
          {
            ...params,
            types: getDestinationQueryTypes(),
          },
          correlationId,
        ),
      () => [{ active_destination_count: 0 }] as Record<string, unknown>[],
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "usdcPaymentVolume",
      usdcPaymentVolumeQuery,
      {
        ...params,
        assets: getUsdcPaymentVolumeParams(),
      },
      correlationId,
    ),
    runOptionalQuery(
      "usdcCategory",
      () =>
        runQuery<Record<string, unknown>>(
          "usdcCategory",
          usdcCategoryQuery,
          {
            ...params,
            assets: getUsdcPaymentVolumeParams(),
          },
          correlationId,
        ),
      () => [] as Record<string, unknown>[],
      correlationId,
    ),
    runOptionalQuery(
      "usdcAccount",
      () =>
        runQuery<Record<string, unknown>>(
          "usdcAccount",
          usdcAccountQuery,
          {
            ...params,
            assets: getUsdcPaymentVolumeParams(),
          },
          correlationId,
        ),
      () => [] as Record<string, unknown>[],
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "timeseries",
      timeseriesQuery,
      params,
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "heatmap",
      heatmapQuery,
      params,
      correlationId,
    ),
  ]);

  return {
    assetVolumes: mapAssetPaymentVolumeRows(assetVolumeRows),
    categories: mapCategoryRows(categoryRows),
    transactionCategories: mapTransactionCategoryRows(transactionCategoryRows),
    contracts: mapContractRows(contractRows),
    accounts: mapAccountRows(accountRows),
    destinationAccounts: mapAccountRows(destinationAccountRows),
    sorobanFunctions: mapSorobanFunctionRows(sorobanFunctionRows),
    sorobanFunctionContracts: mapSorobanFunctionContractRows(
      sorobanFunctionContractRows,
    ),
    activeSourceAccounts: mapActiveSourceAccountsRows(activeSourceAccountRows),
    activeDestinationCount: mapActiveDestinationCountRow(
      activeDestinationCountRows,
    ),
    usdcPaymentVolume: mapUsdcPaymentVolumeRows(usdcPaymentVolumeRows),
    usdcCategories: mapUsdcCategoryRows(usdcCategoryRows),
    usdcAccounts: mapUsdcAccountRows(usdcAccountRows),
    timeseries: mapTimeseriesRows(timeseriesRows),
    heatmap: mapHeatmapRows(heatmapRows),
  };
}

async function fetchHomeDomains(ids: string[], correlationId: string) {
  if (ids.length === 0) {
    return {};
  }

  const rows = await runOptionalQuery(
    "accountMetadata",
    () =>
      runQuery<Record<string, unknown>>(
        "accountMetadata",
        accountMetadataQuery,
        { ids },
        correlationId,
      ),
    () => [] as Record<string, unknown>[],
    correlationId,
  );

  return homeDomainsToEntities(mapAccountMetadataRows(rows));
}

// Uncapped distinct active-contract count for a period. Independent of the
// capped contract leaderboard (contractQuery/TOP_CONTRACT_LIMIT) used for the
// existing KPI card and treemaps.
export async function getActiveContractCount(
  start: string,
  end: string,
  correlationId: string = createCorrelationId(),
): Promise<ActiveContractCountRow> {
  const rows = await runOptionalQuery(
    "activeContractCount",
    () =>
      runQuery<Record<string, unknown>>(
        "activeContractCount",
        activeContractCountQuery,
        {
          start,
          end,
        },
        correlationId,
      ),
    () => [{ active_contract_count: 0 }] as Record<string, unknown>[],
    correlationId,
  );

  return mapActiveContractCountRow(rows);
}

async function fetchLatestDataTimestamp(
  correlationId: string,
): Promise<string | null> {
  const rows = await runQuery<Record<string, unknown>>(
    "latestDataTimestamp",
    latestDataTimestampQuery,
    {},
    correlationId,
  );

  if (rows.length === 0 || rows[0].latest_timestamp == null) {
    return null;
  }

  return String(rows[0].latest_timestamp);
}

export function buildTimeseries(
  period: Period,
  start: Date,
  end: Date,
  rawRows: TimeseriesRawRow[],
  now = new Date(),
  granularityOverride?: "hour" | "day",
): ActivityTimeseries {
  const granularity = granularityOverride ?? (period === "1d" ? "hour" : "day");
  const buckets: TimeseriesBucket[] = [];

  const lookup = new Map<
    string,
    { tx_count: number; op_count: number; soroban_op_count: number }
  >();
  for (const row of rawRows) {
    if (!row.bucket_time) continue;
    const dt = new Date(row.bucket_time);
    if (isNaN(dt.getTime())) continue;
    const key =
      granularity === "hour"
        ? dt.toISOString().substring(0, 13)
        : dt.toISOString().substring(0, 10);

    const existing = lookup.get(key) ?? {
      tx_count: 0,
      op_count: 0,
      soroban_op_count: 0,
    };
    lookup.set(key, {
      tx_count: existing.tx_count + row.tx_count,
      op_count: existing.op_count + row.op_count,
      soroban_op_count: existing.soroban_op_count + (row.soroban_op_count ?? 0),
    });
  }

  const currentHourKey = now.toISOString().substring(0, 13);
  const currentDayKey = now.toISOString().substring(0, 10);

  if (granularity === "hour") {
    let curr = startOfHour(start);
    const limit = end;
    while (curr <= limit) {
      const iso = curr.toISOString();
      const hourKey = iso.substring(0, 13);
      const data = lookup.get(hourKey) ?? {
        tx_count: 0,
        op_count: 0,
        soroban_op_count: 0,
      };

      const isCurrentHour = hourKey === currentHourKey;
      const isPastNow = curr > now;

      if (!isPastNow || buckets.length === 0 || curr <= addHours(now, 1)) {
        const utcHour = String(curr.getUTCHours()).padStart(2, "0");
        buckets.push({
          timestamp: iso,
          label: `${utcHour}:00 UTC`,
          transactions: data.tx_count,
          operations: data.op_count,
          sorobanOperations: data.soroban_op_count,
          isPartial: isCurrentHour || (curr <= now && addHours(curr, 1) > now),
        });
      }

      curr = addHours(curr, 1);
    }
  } else {
    let curr = startOfDay(start);
    const limit = end;
    while (curr <= limit) {
      const iso = curr.toISOString();
      const dayKey = iso.substring(0, 10);
      const data = lookup.get(dayKey) ?? {
        tx_count: 0,
        op_count: 0,
        soroban_op_count: 0,
      };

      const isCurrentDay = dayKey === currentDayKey;
      const isPastNow = curr > startOfDay(now);

      if (!isPastNow || buckets.length === 0 || curr <= now) {
        const monthStr = curr.toLocaleString("en-US", {
          month: "short",
          timeZone: "UTC",
        });
        const dayNum = curr.getUTCDate();
        buckets.push({
          timestamp: iso,
          label: `${monthStr} ${dayNum}`,
          transactions: data.tx_count,
          operations: data.op_count,
          sorobanOperations: data.soroban_op_count,
          isPartial: isCurrentDay || (curr <= now && addDays(curr, 1) > now),
        });
      }

      curr = addDays(curr, 1);
    }
  }

  const totalTx = buckets.reduce((acc, b) => acc + b.transactions, 0);
  const totalOps = buckets.reduce((acc, b) => acc + b.operations, 0);

  return {
    granularity,
    buckets,
    totals: {
      transactions: totalTx,
      operations: totalOps,
    },
  };
}

export function buildHeatmap(rawRows: HeatmapRawRow[]): ActivityHeatmap {
  // Ensure we cover 7x24 grid (168 buckets).
  const buckets: HeatmapBucket[] = [];
  const map = new Map<string, HeatmapRawRow>();
  for (const row of rawRows) {
    map.set(`${row.day_of_week}-${row.hour_of_day}`, row);
  }

  for (let d = 1; d <= 7; d++) {
    // BigQuery DAYOFWEEK is 1 (Sunday) to 7 (Saturday).
    // Let's map it to 0-6 (0 = Sunday).
    const dayOfWeek = d - 1;
    for (let hourOfDay = 0; hourOfDay < 24; hourOfDay++) {
      const row = map.get(`${d}-${hourOfDay}`);
      buckets.push({
        dayOfWeek,
        hourOfDay,
        transactions: row?.tx_count ?? 0,
        operations: row?.op_count ?? 0,
      });
    }
  }

  return { buckets };
}

export class CredentialsMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialsMissingError";
    Object.setPrototypeOf(this, CredentialsMissingError.prototype);
  }
}

export class UpstreamQueryFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamQueryFailedError";
    Object.setPrototypeOf(this, UpstreamQueryFailedError.prototype);
  }
}

export async function getActivityData(
  period: Period,
  correlationId: string = createCorrelationId(),
  network: DashboardNetworkId = "mainnet",
): Promise<ActivityDataset> {
  if (!hasBigQueryCredentials()) {
    throw new CredentialsMissingError(
      "BigQuery credentials are required. Set GOOGLE_APPLICATION_CREDENTIALS in .env.local",
    );
  }

  if (!isTestnetDatasetConfigured(network)) {
    throw new Error(
      "Testnet BigQuery dataset is not configured. Set LUMENMAP_TESTNET_BIGQUERY_DATASET.",
    );
  }

  const range = resolvePeriod(period);
  const cacheKey = `activity:v14:${network}:${period}:${range.start.toISOString()}`;

  const cached = getCached<ActivityDataset>(cacheKey, { track: true });
  if (cached) {
    logInfo({
      event: "activity.cache.hit",
      correlationId,
      period,
    });
    return cached;
  }

  return coalesceInflight(inflightActivityRequests, cacheKey, async () => {
    // Re-check cache after winning/joining the in-flight slot.
    const cachedAfterWait = getCached<ActivityDataset>(cacheKey, {
      track: true,
    });
    if (cachedAfterWait) {
      return cachedAfterWait;
    }

    logInfo({
      event: "activity.cache.miss",
      correlationId,
      period,
    });

    const start = range.start.toISOString();
    const end = range.end.toISOString();

    const fetchTimer = startTimer();
    const raw = await fetchFromHubble(start, end, correlationId, period);
    logInfo({
      event: "activity.fetch.complete",
      correlationId,
      period,
      durationMs: endTimer(fetchTimer),
    });

    const kpiTimer = startTimer();
    const activeContractCount = await getActiveContractCount(
      start,
      end,
      correlationId,
    );
    const kpis = buildKpis(
      raw.categories,
      raw.contracts,
      raw.activeSourceAccounts,
      activeContractCount.active_contract_count,
      raw.activeDestinationCount.active_destination_count,
    );
    logInfo({
      event: "activity.kpi.build",
      correlationId,
      period,
      durationMs: endTimer(kpiTimer),
    });

    const labelTimer = startTimer();
    const labels = await resolveEntityLabels(collectTreemapIds(raw), {
      fetchHomeDomains: (ids) => fetchHomeDomains(ids, correlationId),
    });
    logInfo({
      event: "activity.label.resolve",
      correlationId,
      period,
      durationMs: endTimer(labelTimer),
    });

    const tvlTimer = startTimer();
    let protocolTvlResults: TvlAdapterResult[];
    try {
      protocolTvlResults = await fetchProtocolTvlResults();
    } catch (error) {
      // fetchProtocolTvlResults already isolates individual adapter
      // failures into "failed" results; this catch is defense-in-depth
      // against something unexpected in the registry itself, so a broken
      // adapter registry can never take down the whole activity dataset.
      logError({
        event: "activity.tvl.registry_error",
        correlationId,
        period,
        durationMs: endTimer(tvlTimer),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      protocolTvlResults = PROTOCOL_TVL_FIXTURE_RESULTS;
    }
    logInfo({
      event: "activity.tvl.fetch",
      correlationId,
      period,
      durationMs: endTimer(tvlTimer),
    });

    const treemapTimer = startTimer();
    const treemaps = buildAllTreemaps({ ...raw, labels }, protocolTvlResults);
    const protocols = buildProtocolSummary(raw.accounts, raw.contracts, labels);
    const timeseries = buildTimeseries(
      period,
      range.start,
      range.end,
      raw.timeseries,
    );
    const heatmap = buildHeatmap(raw.heatmap);
    logInfo({
      event: "activity.treemap.build",
      correlationId,
      period,
      durationMs: endTimer(treemapTimer),
    });

    const sourceTimestamp = await fetchLatestDataTimestamp(correlationId);
    const now = new Date();
    const isPeriodComplete = range.end.getTime() <= now.getTime();

    const response: ActivityDataset = {
      period,
      start,
      end,
      source: "hubble",
      sourceTimestamp: sourceTimestamp ?? "",
      isPeriodComplete,
      categories: raw.categories,
      transactionCategories: raw.transactionCategories,
      contracts: raw.contracts,
      accounts: raw.accounts,
      destinationAccounts: raw.destinationAccounts,
      sorobanFunctions: raw.sorobanFunctions,
      sorobanFunctionContracts: raw.sorobanFunctionContracts,
      usdcPaymentVolume: raw.usdcPaymentVolume,
      assetVolumes: raw.assetVolumes,
      usdcCategories: raw.usdcCategories,
      usdcAccounts: raw.usdcAccounts,
      kpis,
      treemaps,
      protocols,
      timeseries,
      heatmap,
      metricProvenance: buildActivityMetricProvenance(network),
    };

    setCache(cacheKey, response);
    return response;
  });
}
