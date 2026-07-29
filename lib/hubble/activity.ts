import { getBigQueryClient } from "@/lib/hubble/client";
import { getCached, setCache } from "@/lib/hubble/cache";
import {
  accountQuery,
  accountMetadataQuery,
  activeContractCountQuery,
  categoryQuery,
  contractQuery,
  getAccountQueryTypes,
  mapAccountMetadataRows,
  mapAccountRows,
  mapActiveContractCountRows,
  mapCategoryRows,
  mapContractRows,
  mapSorobanFunctionContractRows,
  mapSorobanFunctionRows,
  sorobanFunctionContractQuery,
  sorobanFunctionQuery,
  type RawQueryResults,
} from "@/lib/hubble/queries";
import { hasBigQueryCredentials } from "@/lib/hubble/client";
import { buildAllTreemaps, buildKpis } from "@/lib/entities/build-treemap";
import {
  collectTreemapIds,
  homeDomainsToEntities,
  resolveEntityLabels,
} from "@/lib/entities/resolve-labels";
import { buildActivityProvenance } from "@/lib/metrics/provenance";
import { resolvePeriod } from "@/lib/periods";
import type { ActivityResponse, Period } from "@/lib/types";

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
    activeContractCountRows,
    accountRows,
    sorobanFunctionRows,
    sorobanFunctionContractRows,
  ] = await Promise.all([
    runQuery<Record<string, unknown>>(categoryQuery, params),
    runQuery<Record<string, unknown>>(contractQuery, params),
    runQuery<Record<string, unknown>>(activeContractCountQuery, params),
    runQuery<Record<string, unknown>>(accountQuery, {
      ...params,
      types: getAccountQueryTypes(),
    }),
    runQuery<Record<string, unknown>>(sorobanFunctionQuery, params),
    runQuery<Record<string, unknown>>(sorobanFunctionContractQuery, params),
  ]);

  return {
    categories: mapCategoryRows(categoryRows),
    contracts: mapContractRows(contractRows),
    activeContractCount: mapActiveContractCountRows(activeContractCountRows),
    accounts: mapAccountRows(accountRows),
    sorobanFunctions: mapSorobanFunctionRows(sorobanFunctionRows),
    sorobanFunctionContracts: mapSorobanFunctionContractRows(
      sorobanFunctionContractRows,
    ),
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

/** Builds the activity API payload from Hubble (or test) raw results. */
export function buildActivityResponse(
  period: Period,
  start: string,
  end: string,
  raw: RawQueryResults,
  options: {
    source?: ActivityResponse["source"];
    labels?: Parameters<typeof buildAllTreemaps>[0]["labels"];
  } = {},
): ActivityResponse {
  const kpis = buildKpis(raw.categories, raw.activeContractCount);
  const treemaps = buildAllTreemaps({ ...raw, labels: options.labels });

  return {
    period,
    start,
    end,
    source: options.source ?? "hubble",
    categories: raw.categories,
    contracts: raw.contracts,
    accounts: raw.accounts,
    sorobanFunctions: raw.sorobanFunctions,
    sorobanFunctionContracts: raw.sorobanFunctionContracts,
    activeContractCount: raw.activeContractCount,
    kpis,
    provenance: buildActivityProvenance(),
    treemaps,
  };
}

export async function getActivityData(period: Period): Promise<ActivityResponse> {
  if (!hasBigQueryCredentials()) {
    throw new Error(
      "BigQuery credentials are required. Set GOOGLE_APPLICATION_CREDENTIALS in .env.local",
    );
  }

  const range = resolvePeriod(period);
  const cacheKey = `activity:v11:${period}:${range.start.toISOString()}`;

  const cached = getCached<ActivityResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();
  const raw = await fetchFromHubble(start, end);
  const labels = await resolveEntityLabels(collectTreemapIds(raw), {
    fetchHomeDomains,
  });
  const response = buildActivityResponse(period, start, end, raw, { labels });

  setCache(cacheKey, response);
  return response;
}
