import { getBigQueryClient } from "@/lib/hubble/client";
import { getCached, setCache } from "@/lib/hubble/cache";
import { getMaxBytesBilledLimit } from "@/lib/hubble/config";
import {
  BigQueryLimitExceededError,
  isBytesBilledLimitExceededError,
} from "@/lib/hubble/errors";
import { coalesceInflight } from "@/lib/hubble/inflight";
import {
  accountQuery,
  accountMetadataQuery,
  activeContractCountQuery,
  activeSourceAccountsQuery,
  categoryQuery,
  contractQuery,
  dailyTimeseriesQuery,
  hourlyTimeseriesQuery,
  getAccountQueryTypes,
  getUsdcPaymentVolumeParams,
  latestDataTimestampQuery,
  mapAccountMetadataRows,
  mapAccountRows,
  mapActiveContractCountRow,
  mapActiveSourceAccountsRows,
  mapCategoryRows,
  mapContractRows,
  mapSorobanFunctionContractRows,
  mapSorobanFunctionRows,
  mapTransactionCategoryRows,
  mapTimeseriesRows,
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
import { buildAllTreemaps, buildKpis, buildProtocolSummary } from "@/lib/entities/build-treemap";
import {
  collectTreemapIds,
  homeDomainsToEntities,
  resolveEntityLabels,
} from "@/lib/entities/resolve-labels";
import { resolvePeriod } from "@/lib/periods";
import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type {
  ActiveContractCountRow,
  ActivityDataset,
  Period,
  ActivityTimeseries,
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
    const [rows] = await client.query({
      query,
      params,
      maximumBytesBilled: limit.toString(),
    });

    logInfo({
      event: "activity.query.complete",
      correlationId,
      queryName: name,
      durationMs: endTimer(timer),
      rowCount: (rows as unknown[]).length,
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

  const [
    categoryRows,
    transactionCategoryRows,
    contractRows,
    accountRows,
    sorobanFunctionRows,
    sorobanFunctionContractRows,
    activeSourceAccountRows,
    usdcPaymentVolumeRows,
    usdcCategoryRows,
    usdcAccountRows,
    timeseriesRows,
  ] = await Promise.all([
    runQuery<Record<string, unknown>>("category", categoryQuery, params, correlationId),
    runQuery<Record<string, unknown>>(
      "transactionCategory",
      transactionCategoryQuery,
      params,
      correlationId,
    ).catch(() => [] as Record<string, unknown>[]),
    runQuery<Record<string, unknown>>("contract", contractQuery, params, correlationId),
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
    runQuery<Record<string, unknown>>(
      "usdcPaymentVolume",
      usdcPaymentVolumeQuery,
      {
        ...params,
        assets: getUsdcPaymentVolumeParams(),
      },
      correlationId,
    ),
    runQuery<Record<string, unknown>>(
      "usdcCategory",
      usdcCategoryQuery,
      {
        ...params,
        assets: getUsdcPaymentVolumeParams(),
      },
      correlationId,
    ).catch(() => [] as Record<string, unknown>[]),
    runQuery<Record<string, unknown>>(
      "usdcAccount",
      usdcAccountQuery,
      {
        ...params,
        assets: getUsdcPaymentVolumeParams(),
      },
      correlationId,
    ).catch(() => [] as Record<string, unknown>[]),
    runQuery<Record<string, unknown>>(
      "timeseries",
      timeseriesQuery,
      params,
      correlationId,
    ),
  ]);

  return {
    categories: mapCategoryRows(categoryRows),
    transactionCategories: mapTransactionCategoryRows(transactionCategoryRows),
    contracts: mapContractRows(contractRows),
    accounts: mapAccountRows(accountRows),
    sorobanFunctions: mapSorobanFunctionRows(sorobanFunctionRows),
    sorobanFunctionContracts: mapSorobanFunctionContractRows(
      sorobanFunctionContractRows,
    ),
    activeSourceAccounts: mapActiveSourceAccountsRows(activeSourceAccountRows),
    usdcPaymentVolume: mapUsdcPaymentVolumeRows(usdcPaymentVolumeRows),
    usdcCategories: mapUsdcCategoryRows(usdcCategoryRows),
    usdcAccounts: mapUsdcAccountRows(usdcAccountRows),
    timeseries: mapTimeseriesRows(timeseriesRows),
  };
}

async function fetchHomeDomains(ids: string[], correlationId: string) {
  if (ids.length === 0) {
    return {};
  }

  const rows = await runQuery<Record<string, unknown>>(
    "accountMetadata",
    accountMetadataQuery,
    { ids },
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
  const rows = await runQuery<Record<string, unknown>>(
    "activeContractCount",
    activeContractCountQuery,
    {
      start,
      end,
    },
    correlationId,
  );

  return mapActiveContractCountRow(rows);
}

async function fetchLatestDataTimestamp(correlationId: string): Promise<string | null> {
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
): ActivityTimeseries {
  const granularity = period === "1d" ? "hour" : "day";
  const buckets: TimeseriesBucket[] = [];

  const lookup = new Map<string, { tx_count: number; op_count: number }>();
  for (const row of rawRows) {
    if (!row.bucket_time) continue;
    const dt = new Date(row.bucket_time);
    if (isNaN(dt.getTime())) continue;
    const key =
      granularity === "hour"
        ? dt.toISOString().substring(0, 13)
        : dt.toISOString().substring(0, 10);

    const existing = lookup.get(key) ?? { tx_count: 0, op_count: 0 };
    lookup.set(key, {
      tx_count: existing.tx_count + row.tx_count,
      op_count: existing.op_count + row.op_count,
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
      const data = lookup.get(hourKey) ?? { tx_count: 0, op_count: 0 };

      const isCurrentHour = hourKey === currentHourKey;
      const isPastNow = curr > now;

      if (!isPastNow || buckets.length === 0 || curr <= addHours(now, 1)) {
        const utcHour = String(curr.getUTCHours()).padStart(2, "0");
        buckets.push({
          timestamp: iso,
          label: `${utcHour}:00 UTC`,
          transactions: data.tx_count,
          operations: data.op_count,
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
      const data = lookup.get(dayKey) ?? { tx_count: 0, op_count: 0 };

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

export async function getActivityData(
  period: Period,
  correlationId: string = createCorrelationId(),
): Promise<ActivityDataset> {
  if (!hasBigQueryCredentials()) {
    throw new Error(
      "BigQuery credentials are required. Set GOOGLE_APPLICATION_CREDENTIALS in .env.local",
    );
  }

  const range = resolvePeriod(period);
  const cacheKey = `activity:v13:${period}:${range.start.toISOString()}`;

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
    const cachedAfterWait = getCached<ActivityDataset>(cacheKey, { track: true });
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
    const activeContractCount = await getActiveContractCount(start, end, correlationId);
    const kpis = buildKpis(
      raw.categories,
      raw.contracts,
      raw.activeSourceAccounts,
      activeContractCount.active_contract_count,
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

    const treemapTimer = startTimer();
    const treemaps = buildAllTreemaps({ ...raw, labels });
  const protocols = buildProtocolSummary(raw.accounts, raw.contracts, labels);
  const timeseries = buildTimeseries(period, range.start, range.end, raw.timeseries);
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
      sorobanFunctions: raw.sorobanFunctions,
      sorobanFunctionContracts: raw.sorobanFunctionContracts,
      usdcPaymentVolume: raw.usdcPaymentVolume,
      usdcCategories: raw.usdcCategories,
      usdcAccounts: raw.usdcAccounts,
      kpis,
      treemaps,
      protocols,
      timeseries,
      metricProvenance: buildActivityMetricProvenance(),
    };

    setCache(cacheKey, response);
    return response;
  });

}
