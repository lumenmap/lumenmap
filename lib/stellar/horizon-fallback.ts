import {
  buildAllTreemaps,
  buildKpis,
  buildProtocolSummary,
} from "@/lib/entities/build-treemap";
import { getAllEntities } from "@/lib/entities/registry";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type { DashboardNetworkId } from "@/lib/network";
import { resolvePeriod } from "@/lib/periods";
import { PROTOCOL_TVL_FIXTURE_RESULTS } from "@/lib/tvl/protocol-registry";
import type {
  AccountRow,
  ActiveDestinationCountRow,
  ActiveSourceAccountsRow,
  ActivityDataset,
  CategoryRow,
  ContractRow,
  Period,
} from "@/lib/types";

export interface HorizonOperationRecord {
  id: string;
  type: string;
  created_at: string;
  transaction_hash?: string;
  source_account?: string;
  from?: string;
  to?: string;
  account?: string;
  into?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
  contract?: string;
  function?: string;
}

export interface HorizonOperationsResponse {
  _embedded?: {
    records?: HorizonOperationRecord[];
  };
}

const DEFAULT_HORIZON_TIMEOUT_MS = 5_000;

export function isHorizonFallbackEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const flag = (env.LUMENMAP_HORIZON_FALLBACK ?? "").trim().toLowerCase();
  const source = (env.LUMENMAP_DATA_SOURCE ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || source === "horizon";
}

export function getHorizonBaseUrl(
  network: DashboardNetworkId = "mainnet",
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const custom = (env.STELLAR_HORIZON_URL ?? "").trim().replace(/\/+$/, "");
  if (custom) return custom;
  return network === "testnet"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";
}

export function aggregateHorizonOperations(records: HorizonOperationRecord[]): {
  categories: CategoryRow[];
  accounts: AccountRow[];
  contracts: ContractRow[];
  activeSourceAccounts: ActiveSourceAccountsRow[];
  activeDestinationCount: ActiveDestinationCountRow;
  latestTimestamp: string;
} {
  const categoryMap = new Map<string, { opCount: number; xlmVolume: number }>();
  const accountMap = new Map<
    string,
    { account_id: string; type_string: string; op_count: number; xlm_volume: number }
  >();
  const contractMap = new Map<string, number>();
  const sourceAccountSet = new Set<string>();
  const destinationSet = new Set<string>();
  let latestTimestamp = "";

  for (const op of records) {
    const typeString = op.type || "unknown";
    const isNative = op.asset_type === "native" || (!op.asset_type && op.type === "create_account");
    const parsedAmount = Number(op.amount ?? 0);
    const xlmAmount =
      isNative && Number.isFinite(parsedAmount) && parsedAmount > 0
        ? parsedAmount
        : 0;

    const currentCat = categoryMap.get(typeString) ?? {
      opCount: 0,
      xlmVolume: 0,
    };
    currentCat.opCount += 1;
    currentCat.xlmVolume += xlmAmount;
    categoryMap.set(typeString, currentCat);

    const sourceAccount = op.source_account ?? op.from;
    if (sourceAccount && !sourceAccount.startsWith("M")) {
      sourceAccountSet.add(sourceAccount);
      const acctKey = `${sourceAccount}:${typeString}`;
      const currentAcct = accountMap.get(acctKey) ?? {
        account_id: sourceAccount,
        type_string: typeString,
        op_count: 0,
        xlm_volume: 0,
      };
      currentAcct.op_count += 1;
      currentAcct.xlm_volume += xlmAmount;
      accountMap.set(acctKey, currentAcct);
    }

    const dest = op.to ?? op.account ?? op.into;
    if (dest) {
      destinationSet.add(dest);
    }

    if (op.type === "invoke_host_function" && op.contract) {
      contractMap.set(op.contract, (contractMap.get(op.contract) ?? 0) + 1);
    }

    if (op.created_at && op.created_at > latestTimestamp) {
      latestTimestamp = op.created_at;
    }
  }

  const categories: CategoryRow[] = Array.from(categoryMap.entries())
    .map(([type_string, stats]) => ({
      type_string,
      op_count: stats.opCount,
      xlm_volume: Number(stats.xlmVolume.toFixed(7)),
    }))
    .sort((a, b) => b.op_count - a.op_count);

  const accounts: AccountRow[] = Array.from(accountMap.values()).sort(
    (a, b) => b.op_count - a.op_count,
  );

  const contracts: ContractRow[] = Array.from(contractMap.entries())
    .map(([contract_id, op_count]) => ({ contract_id, op_count }))
    .sort((a, b) => b.op_count - a.op_count);

  return {
    categories,
    accounts,
    contracts,
    activeSourceAccounts: [{ active_accounts: sourceAccountSet.size }],
    activeDestinationCount: { active_destination_count: destinationSet.size },
    latestTimestamp: latestTimestamp || new Date().toISOString(),
  };
}

export async function fetchHorizonFallbackDataset(
  period: Period,
  network: DashboardNetworkId = "mainnet",
  options: {
    anchor?: Date;
    fetchImpl?: typeof globalThis.fetch;
    limit?: number;
  } = {},
): Promise<ActivityDataset> {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const limit = options.limit ?? 200;
  const baseUrl = getHorizonBaseUrl(network);
  const url = `${baseUrl}/operations?order=desc&limit=${limit}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    DEFAULT_HORIZON_TIMEOUT_MS,
  );

  let records: HorizonOperationRecord[] = [];
  try {
    const response = await fetchFn(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Horizon fallback HTTP ${response.status}`);
    }
    const payload = (await response.json()) as HorizonOperationsResponse;
    records = payload._embedded?.records ?? [];
  } finally {
    clearTimeout(timeout);
  }

  const range = resolvePeriod(period, options.anchor);
  const start = range.start.toISOString();
  const end = range.end.toISOString();
  const aggregated = aggregateHorizonOperations(records);
  const labels = getAllEntities();

  const kpis = buildKpis(
    aggregated.categories,
    aggregated.contracts,
    aggregated.activeSourceAccounts,
    aggregated.contracts.length,
    aggregated.activeDestinationCount.active_destination_count,
  );

  const rawForTreemap = {
    categories: aggregated.categories,
    transactionCategories: aggregated.categories.map((c) => ({
      type_string: c.type_string,
      txn_count: c.op_count,
    })),
    contracts: aggregated.contracts,
    accounts: aggregated.accounts,
    destinationAccounts: [],
    sorobanFunctions: [],
    sorobanFunctionContracts: [],
    usdcPaymentVolume: {
      amount: 0,
      unit: "USDC" as const,
      assetSetId: "stellar-mainnet-usdc-v1",
      methodology: "docs/metric-methodology.md#usdc-payment-volume",
      assets: [],
    },
    assetVolumes: [],
    usdcCategories: [],
    usdcAccounts: [],
    activeSourceAccounts: aggregated.activeSourceAccounts,
    activeDestinationCount: aggregated.activeDestinationCount,
    timeseries: [],
    heatmap: [],
    labels,
  };

  const treemaps = buildAllTreemaps(rawForTreemap, PROTOCOL_TVL_FIXTURE_RESULTS);
  const protocols = buildProtocolSummary(
    aggregated.accounts,
    aggregated.contracts,
    labels,
  );
  const isPeriodComplete = range.end.getTime() <= Date.now();

  return {
    period,
    start,
    end,
    source: "hubble",
    sourceTimestamp: aggregated.latestTimestamp,
    isPeriodComplete,
    categories: aggregated.categories,
    transactionCategories: rawForTreemap.transactionCategories,
    contracts: aggregated.contracts,
    accounts: aggregated.accounts,
    destinationAccounts: [],
    sorobanFunctions: [],
    sorobanFunctionContracts: [],
    usdcPaymentVolume: rawForTreemap.usdcPaymentVolume,
    assetVolumes: [],
    usdcCategories: [],
    usdcAccounts: [],
    kpis,
    treemaps,
    protocols,
    timeseries: {
      granularity: period === "1d" ? "hour" : "day",
      buckets: [],
    },
    heatmap: { buckets: [] },
    metricProvenance: buildActivityMetricProvenance(network),
  };
}
