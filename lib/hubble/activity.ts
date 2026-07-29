import { getBigQueryClient } from "@/lib/hubble/client";
import { getCached, setCache } from "@/lib/hubble/cache";
import {
  accountQuery,
  accountMetadataQuery,
  categoryQuery,
  contractQuery,
  getAccountQueryTypes,
  mapAccountMetadataRows,
  mapAccountRows,
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
import { resolvePeriod } from "@/lib/periods";
import type { ActivityResponse, Period } from "@/lib/types";
import { fetchAllProtocolSnapshots } from "@/lib/adapters/protocol-adapters";
import { buildProtocolTreemap } from "@/lib/adapters/build-protocol-treemap";

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
  ] = await Promise.all([
    runQuery<Record<string, unknown>>(categoryQuery, params),
    runQuery<Record<string, unknown>>(contractQuery, params),
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

export async function getActivityData(period: Period): Promise<ActivityResponse> {
  if (!hasBigQueryCredentials()) {
    throw new Error(
      "BigQuery credentials are required. Set GOOGLE_APPLICATION_CREDENTIALS in .env.local",
    );
  }

  const range = resolvePeriod(period);
  const cacheKey = `activity:v10:${period}:${range.start.toISOString()}`;

  const cached = getCached<ActivityResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();
  const raw = await fetchFromHubble(start, end);
  const kpis = buildKpis(raw.categories, raw.contracts);
  const labels = await resolveEntityLabels(collectTreemapIds(raw), {
    fetchHomeDomains,
  });
  const treemaps = buildAllTreemaps({ ...raw, labels });

  // Fetch protocol TVL data
  const protocolSnapshots = await fetchAllProtocolSnapshots();
  const protocolTreemap = buildProtocolTreemap(protocolSnapshots);

  const response: ActivityResponse = {
    period,
    start,
    end,
    source: "hubble",
    categories: raw.categories,
    contracts: raw.contracts,
    accounts: raw.accounts,
    sorobanFunctions: raw.sorobanFunctions,
    sorobanFunctionContracts: raw.sorobanFunctionContracts,
    kpis,
    treemaps: {
      ...treemaps,
      protocols: protocolTreemap,
    },
  };

  setCache(cacheKey, response);
  return response;
}
