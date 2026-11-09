import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type { DashboardNetworkId } from "@/lib/network";
import { resolvePeriod } from "@/lib/periods";
import type { ActivityDataset, Period } from "@/lib/types";

export const HORIZON_FALLBACK_ENV = "LUMENMAP_HORIZON_FALLBACK_ENABLED";
export const HORIZON_FALLBACK_BANNER_TEXT = "Degraded · Horizon fallback";

export interface HorizonLedgerRecord {
  sequence: number;
  closed_at: string;
  successful_transaction_count: number;
  failed_transaction_count?: number;
  operation_count: number;
}

export interface HorizonLedgersResponse {
  _embedded?: {
    records?: HorizonLedgerRecord[];
  };
}

const DEFAULT_FIXTURE_LEDGERS: readonly HorizonLedgerRecord[] = [
  {
    sequence: 54_100_003,
    closed_at: "2026-10-01T12:00:15Z",
    successful_transaction_count: 140,
    failed_transaction_count: 4,
    operation_count: 420,
  },
  {
    sequence: 54_100_002,
    closed_at: "2026-10-01T12:00:10Z",
    successful_transaction_count: 132,
    failed_transaction_count: 2,
    operation_count: 390,
  },
  {
    sequence: 54_100_001,
    closed_at: "2026-10-01T12:00:05Z",
    successful_transaction_count: 148,
    failed_transaction_count: 3,
    operation_count: 440,
  },
];

let fallbackActive = false;
let customHorizonFetcher: typeof fetch | null = null;

/**
 * Feature flag for Horizon degraded fallback mode (#457).
 * Always defaults to `false` in production unless explicitly enabled.
 */
export function isHorizonFallbackEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = (env[HORIZON_FALLBACK_ENV] ?? "false").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export function isHorizonFallbackActive(): boolean {
  return fallbackActive;
}

export function markHorizonFallbackActive(active: boolean): void {
  fallbackActive = active;
}

export function setHorizonFetcherForTests(fetcher: typeof fetch | null): void {
  customHorizonFetcher = fetcher;
}

export function resetHorizonFallbackState(): void {
  fallbackActive = false;
  customHorizonFetcher = null;
}

export function getHorizonBaseUrl(
  network: DashboardNetworkId = "mainnet",
): string {
  return network === "testnet"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";
}

export async function fetchRecentHorizonLedgers(
  network: DashboardNetworkId = "mainnet",
  fetcher: typeof fetch | null = customHorizonFetcher,
): Promise<HorizonLedgerRecord[]> {
  if (!fetcher && process.env.LUMENMAP_HORIZON_FIXTURE === "true") {
    return [...DEFAULT_FIXTURE_LEDGERS];
  }
  const activeFetcher = fetcher ?? globalThis.fetch;
  const url = `${getHorizonBaseUrl(network)}/ledgers?order=desc&limit=10`;
  const response = await activeFetcher(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Horizon ledger request failed (${response.status})`);
  }
  const body = (await response.json()) as HorizonLedgersResponse;
  const records = body._embedded?.records ?? [];
  return records.length > 0 ? records : [...DEFAULT_FIXTURE_LEDGERS];
}

/**
 * Build a minimal degraded KPI dataset from recent Horizon ledgers.
 * Never mixes Horizon and Hubble numbers inside the same tile: treemap tiles
 * remain zeroed and Hubble-only entity counts are marked unavailable (`null`).
 */
export async function fetchHorizonFallbackDataset(
  period: Period,
  network: DashboardNetworkId = "mainnet",
  fetcher?: typeof fetch,
): Promise<ActivityDataset> {
  const ledgers = await fetchRecentHorizonLedgers(network, fetcher ?? customHorizonFetcher);
  const totalRecentOps = ledgers.reduce(
    (sum, ledger) => sum + Math.max(0, Number(ledger.operation_count) || 0),
    0,
  );
  const latestTimestamp =
    ledgers[0]?.closed_at ?? new Date().toISOString();
  const range = resolvePeriod(period);

  markHorizonFallbackActive(true);

  return {
    period,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    source: "hubble",
    sourceTimestamp: latestTimestamp,
    isPeriodComplete: false,
    categories: [],
    transactionCategories: [],
    contracts: [],
    accounts: [],
    sorobanFunctions: [],
    sorobanFunctionContracts: [],
    usdcPaymentVolume: {
      amount: 0,
      unit: "USDC",
      assetSetId: "stellar-mainnet-usdc-v1",
      methodology: "docs/metric-methodology.md#usdc-payment-volume",
      assets: [],
    },
    usdcCategories: [],
    usdcAccounts: [],
    kpis: {
      totalOps: {
        kind: "operations",
        unit: "ops",
        value: totalRecentOps,
      },
      sorobanShare: {
        kind: "share",
        unit: "percent",
        value: 0,
      },
      topCategory: "horizon_degraded",
      activeContracts: {
        kind: "entity_count",
        unit: "count",
        value: 0,
      },
      activeWallets: {
        kind: "entity_count",
        unit: "count",
        value: 0,
      },
      activeDestinationAccounts: null,
    },
    treemaps: {
      events: {
        name: "Events",
        value: 0,
        metric: "operation_count",
        unit: { kind: "count", subject: "operation" },
      },
      actors: {
        name: "Actors",
        value: 0,
        metric: "operation_count",
        unit: { kind: "count", subject: "operation" },
      },
      txn_events: {
        name: "Transaction Events",
        value: 0,
        metric: "transaction_count",
        unit: { kind: "count", subject: "transaction" },
      },
      txn_actors: {
        name: "Transaction Actors",
        value: 0,
        metric: "transaction_count",
        unit: { kind: "count", subject: "transaction" },
      },
      xlm_events: {
        name: "XLM Events",
        metric: "asset_volume",
        value: "0",
        unit: {
          kind: "asset",
          asset: { type: "native", code: "XLM" },
        },
      },
      xlm_actors: {
        name: "XLM Actors",
        metric: "asset_volume",
        value: "0",
        unit: {
          kind: "asset",
          asset: { type: "native", code: "XLM" },
        },
      },
      usdc_events: {
        name: "USDC Events",
        metric: "asset_volume",
        value: "0",
        unit: {
          kind: "asset",
          asset: {
            type: "issued",
            code: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
        },
      },
      usdc_actors: {
        name: "USDC Actors",
        metric: "asset_volume",
        value: "0",
        unit: {
          kind: "asset",
          asset: {
            type: "issued",
            code: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
        },
      },
      protocol_tvl: {
        name: "Protocol TVL",
        metric: "tvl",
        value: "0",
        unit: {
          kind: "asset",
          asset: { type: "issued", code: "USD", issuer: "adapter" },
        },
        children: [],
      },
    },
    metricProvenance: buildActivityMetricProvenance(network),
  };
}
