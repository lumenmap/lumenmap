import { getBigQueryClient } from "@/lib/hubble/client";
import { getCached, setCache } from "@/lib/hubble/cache";
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
  mapUsdcPaymentVolumeRows,
  sorobanFunctionContractQuery,
  sorobanFunctionQuery,
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

async function runQuery<T>(
  query: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const client = getBigQueryClient();
  if (!client) {
    throw new Error("BigQuery client is not configured");
  }

  const [rows] = await client.query({
    query,
    params,
  });

  return rows as T[];
}

async function fetchFromHubble(
  start: string,
  end: string,
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
  ] = await Promise.all([
    runQuery<Record<string, unknown>>(categoryQuery, params),
    runQuery<Record<string, unknown>>(contractQuery, params),
    runQuery<Record<string, unknown>>(accountQuery, {
      ...params,
      types: getAccountQueryTypes(),
    }),
    runQuery<Record<string, unknown>>(sorobanFunctionQuery, params),
    runQuery<Record<string, unknown>>(sorobanFunctionContractQuery, params),
    runQuery<Record<string, unknown>>(activeSourceAccountsQuery, params),
    runQuery<Record<string, unknown>>(usdcPaymentVolumeQuery, {
      ...params,
      assets: getUsdcPaymentVolumeParams(),
    }),
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
  };
}

async function fetchHomeDomains(ids: string[]) {
  if (ids.length === 0) {
    return {};
  }

  const rows = await runQuery<Record<string, unknown>>(accountMetadataQuery, {
    ids,
  });

  return homeDomainsToEntities(mapAccountMetadataRows(rows));
}

// Uncapped distinct active-contract count for a period. Independent of the
// capped contract leaderboard (contractQuery/TOP_CONTRACT_LIMIT) used for the
// existing KPI card and treemaps.
export async function getActiveContractCount(
  start: string,
  end: string,
): Promise<ActiveContractCountRow> {
  const rows = await runQuery<Record<string, unknown>>(activeContractCountQuery, {
    start,
    end,
  });

  return mapActiveContractCountRow(rows);
}

async function fetchLatestDataTimestamp(): Promise<string | null> {
  const rows = await runQuery<
    Record<string, unknown>
  >(latestDataTimestampQuery, {});

  if (rows.length === 0 || rows[0].latest_timestamp == null) {
    return null;
  }

  return String(rows[0].latest_timestamp);
}

export async function getActivityData(period: Period): Promise<ActivityDataset> {
  if (!hasBigQueryCredentials()) {
    throw new Error(
      "BigQuery credentials are required. Set GOOGLE_APPLICATION_CREDENTIALS in .env.local",
    );
  }

  const range = resolvePeriod(period);
  const cacheKey = `activity:v12:${period}:${range.start.toISOString()}`;

  const cached = getCached<ActivityDataset>(cacheKey);
  if (cached) {
    return cached;
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();
  const raw = await fetchFromHubble(start, end);
  const kpis = buildKpis(raw.categories, raw.contracts, raw.activeSourceAccounts);
  const labels = await resolveEntityLabels(collectTreemapIds(raw), {
    fetchHomeDomains,
  });
  const treemaps = buildAllTreemaps({ ...raw, labels });
  const sourceTimestamp = await fetchLatestDataTimestamp();
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
    kpis,
    treemaps,
    metricProvenance: buildActivityMetricProvenance(),
  };

  setCache(cacheKey, response);
  return response;
}
