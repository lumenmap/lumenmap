import type { ProtocolTvlAdapter, TvlAdapterResult } from "@/lib/tvl/adapter";
import { ExampleTvlAdapter } from "@/lib/tvl/adapter";
import { DefiLlamaTvlAdapter } from "@/lib/tvl/live-adapters/defillama-tvl-adapter";
import { getEnabledLiveAdapterIds } from "@/lib/tvl/config";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function completeResult(
  protocol: string,
  usdValue: string,
  hoursSinceSnapshot: number,
): TvlAdapterResult {
  return {
    protocol,
    network: "stellar",
    status: "complete",
    methodologyVersion: "1.0.0",
    snapshotTime: hoursAgo(hoursSinceSnapshot),
    positions: [
      {
        canonicalAsset: "USD",
        nativeAmount: usdValue,
        usdValue,
        priceProvenance: {
          source: "fixture-adapter",
          timestamp: hoursAgo(hoursSinceSnapshot),
        },
      },
    ],
  };
}

function staleResult(protocol: string, usdValue: string): TvlAdapterResult {
  return {
    protocol,
    network: "stellar",
    status: "stale",
    methodologyVersion: "1.0.0",
    snapshotTime: hoursAgo(30),
    error: "Snapshot older than 24h",
    positions: [
      {
        canonicalAsset: "USD",
        nativeAmount: usdValue,
        usdValue,
        priceProvenance: {
          source: "fixture-adapter",
          timestamp: hoursAgo(30),
        },
      },
    ],
  };
}

function partialResult(protocol: string, usdValue: string): TvlAdapterResult {
  return {
    protocol,
    network: "stellar",
    status: "partial",
    methodologyVersion: "1.0.0",
    snapshotTime: hoursAgo(8),
    error: "Missing secondary venue inventory",
    positions: [
      {
        canonicalAsset: "USD",
        nativeAmount: usdValue,
        usdValue,
        priceProvenance: {
          source: "fixture-adapter",
          timestamp: hoursAgo(8),
        },
      },
    ],
  };
}

/** Fixture-backed snapshots so Protocol TVL works without live venue APIs. */
export const PROTOCOL_TVL_FIXTURE_RESULTS: TvlAdapterResult[] = [
  completeResult("Soroswap", "15000000", 1),
  completeResult("Circle", "500000000", 0.5),
  partialResult("Kraken", "100000000"),
  staleResult("LOBSTR", "50000000"),
  completeResult("MoneyGram", "75000000", 0.25),
];

export const PROTOCOL_TVL_ADAPTERS: ProtocolTvlAdapter[] =
  PROTOCOL_TVL_FIXTURE_RESULTS.map(
    (result) => new ExampleTvlAdapter(result),
  );

/**
 * Registry of protocol id -> factory for a real, non-fixture adapter.
 *
 * To register a new live adapter:
 *   1. Add a class implementing `ProtocolTvlAdapter` under
 *      `lib/tvl/live-adapters/` (see `defillama-tvl-adapter.ts` for an
 *      example).
 *   2. Add an entry below, keyed by lowercase protocol id.
 *   3. Enable it via the `LUMENMAP_TVL_LIVE_ADAPTERS` environment variable
 *      (see `lib/tvl/config.ts`). Nothing else changes: the treemap
 *      builder, the `ProtocolTvlAdapter` contract, and every other
 *      protocol's fixture are unaffected.
 *
 * See CONTRIBUTING.md "Protocol TVL adapter registry" for the full guide.
 */
const LIVE_ADAPTER_FACTORIES: Record<string, () => ProtocolTvlAdapter> = {
  soroswap: () => new DefiLlamaTvlAdapter("Soroswap", "soroswap"),
};

interface RegistryEntry {
  id: string;
  fixture: TvlAdapterResult;
}

const REGISTRY_ENTRIES: RegistryEntry[] = PROTOCOL_TVL_FIXTURE_RESULTS.map(
  (fixture) => ({ id: fixture.protocol.toLowerCase(), fixture }),
);

/**
 * Builds the list of adapters to query: a live adapter for any protocol id
 * enabled via config (and with a registered factory), the fixture adapter
 * for everything else. With no configuration set, this returns exactly the
 * same fixture adapters as before — existing behaviour is unchanged.
 *
 * `liveFactories` and `enabledIds` are overridable for tests; production
 * code should call this with no arguments.
 */
export function getConfiguredProtocolTvlAdapters(
  liveFactories: Record<string, () => ProtocolTvlAdapter> = LIVE_ADAPTER_FACTORIES,
  enabledIds: Set<string> = getEnabledLiveAdapterIds(),
): { id: string; protocol: string; adapter: ProtocolTvlAdapter }[] {
  return REGISTRY_ENTRIES.map(({ id, fixture }) => {
    const useLive = enabledIds.has(id) && id in liveFactories;
    return {
      id,
      protocol: fixture.protocol,
      adapter: useLive ? liveFactories[id]() : new ExampleTvlAdapter(fixture),
    };
  });
}

/**
 * Fetches TVL results for every configured adapter. Each adapter is
 * isolated: if one throws (rather than resolving to a `failed` status, as
 * `DefiLlamaTvlAdapter` and the fixture adapter always do), it is converted
 * to a `failed` result here rather than rejecting the whole call — a broken
 * adapter must never take down the page.
 */
export async function fetchProtocolTvlResults(
  adapters: {
    id: string;
    protocol: string;
    adapter: ProtocolTvlAdapter;
  }[] = getConfiguredProtocolTvlAdapters(),
): Promise<TvlAdapterResult[]> {
  const settled = await Promise.allSettled(
    adapters.map(({ adapter }) => adapter.getTvl()),
  );

  return settled.map((outcome, index) => {
    if (outcome.status === "fulfilled") return outcome.value;

    const { protocol } = adapters[index];
    const reason = outcome.reason;
    const error = reason instanceof Error ? reason.message : String(reason);

    return {
      protocol,
      network: "stellar",
      status: "failed",
      snapshotTime: new Date().toISOString(),
      error,
    };
  });
}
