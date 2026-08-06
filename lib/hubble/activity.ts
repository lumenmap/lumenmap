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
  mapUsdcAccountRows,
  mapUsdcCategoryRows,
  mapUsdcPaymentVolumeRows,
  sorobanFunctionContractQuery,
  sorobanFunctionQuery,
  usdcAccountQuery,
  usdcCategoryQuery,
  usdcPaymentVolumeQuery,
  type RawQueryResults,
} from "@/lib/hubble/queries";
import { hasBigQueryCredentials } from "@/lib/hubble/client";
import { buildAllTreemaps, buildKpis } from "@/lib/entities/build-treemap";
import {
  collectTreemapIds,
  homeDomainsToEntities,
  resolveEntityLabels,
} from "@/lib/entities/resolve-labels";
import { resolvePeriod } from "@/lib/periods";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type { ActiveContractCountRow, ActivityDataset, Period } from "@/lib/types";
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
): Promise<RawQueryResults> {
  const params = { start, end };

  const [
    categoryRows,
    contractRows,
    accountRows,
    sorobanFunctionRows,
    sorobanFunctionContractRows,
    activeSourceAccountRows,
    usdcPaymentVolumeRows,
    usdcCategoryRows,
    usdcAccountRows,
  ] = await Promise.all([
    runQuery<Record<string, unknown>>("category", categoryQuery, params, correlationId),
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
  ]);

  return {
    categories: mapCategoryRows(categoryRows),
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
  const cacheKey = `activity:v12:${period}:${range.start.toISOString()}`;

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
    const raw = await fetchFromHubble(start, end, correlationId);
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
      contracts: raw.contracts,
      accounts: raw.accounts,
      sorobanFunctions: raw.sorobanFunctions,
      sorobanFunctionContracts: raw.sorobanFunctionContracts,
      usdcPaymentVolume: raw.usdcPaymentVolume,
      usdcCategories: raw.usdcCategories,
      usdcAccounts: raw.usdcAccounts,
      kpis,
      treemaps,
      metricProvenance: buildActivityMetricProvenance(),
    };

    setCache(cacheKey, response);
    return response;
  });

}
