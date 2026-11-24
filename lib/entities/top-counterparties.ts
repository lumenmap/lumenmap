import { getDisplayName, lookupEntity } from "@/lib/entities/registry";
import { FIXTURE_ACCOUNTS } from "@/lib/fixtures/raw-data";

/**
 * Documented top-N cap for the DetailPanel counterparties table.
 * Rows beyond this limit are omitted and surfaced via the "more" note.
 */
export const TOP_COUNTERPARTIES_LIMIT = 10;

/** Minimal edge shape accepted by the ranking helper (Flow edges satisfy this). */
export type CounterpartyEdgeInput = {
  source: string;
  destination: string;
  assetKey: string;
  amount: string;
  /** False when any operation in the edge lacks a reliable amount. */
  amountComplete?: boolean;
  operationCount: number;
};

export type CounterpartyNodeInput = {
  id: string;
  label?: string;
  category?: string;
};

/** Safe single-asset volume; omitted when cross-asset or incomplete. */
export type SafeCounterpartyVolume = {
  assetKey: string;
  assetCode: string;
  /** Minor-unit sum as a decimal string (bigint-safe). */
  amount: string;
};

export type RankedCounterparty = {
  id: string;
  label: string;
  category?: string;
  operationCount: number;
  inflowOps: number;
  outflowOps: number;
  volume?: SafeCounterpartyVolume;
};

export type TopCounterpartiesResult = {
  rows: RankedCounterparty[];
  /** Distinct counterparties before the top-N cap. */
  totalCount: number;
  configuredLimit: number;
  /** True when totalCount exceeded configuredLimit. */
  hasMore: boolean;
  /** Counterparties omitted by the cap (`max(0, totalCount - limit)`). */
  moreCount: number;
};

type MutableCounterparty = {
  id: string;
  label: string;
  category?: string;
  operationCount: number;
  inflowOps: number;
  outflowOps: number;
  assetKeys: Set<string>;
  volumeByAsset: Map<string, bigint>;
  amountComplete: boolean;
};

function parseAmount(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+$/.test(trimmed)) return BigInt(0);
  try {
    return BigInt(trimmed);
  } catch {
    return BigInt(0);
  }
}

function assetCodeFromKey(assetKey: string): string {
  if (assetKey === "native:XLM" || assetKey.startsWith("native:")) return "XLM";
  const code = assetKey.split(":")[0];
  return code || assetKey;
}

function resolveLabel(
  id: string,
  nodes: readonly CounterpartyNodeInput[] | undefined,
): string {
  const fromNode = nodes?.find((node) => node.id === id)?.label;
  if (fromNode) return fromNode;
  return getDisplayName(id);
}

function resolveCategory(
  id: string,
  nodes: readonly CounterpartyNodeInput[] | undefined,
): string | undefined {
  return nodes?.find((node) => node.id === id)?.category ?? lookupEntity(id)?.category;
}

/**
 * Rank direct counterparties for `centerId` by operation count (desc), then id.
 *
 * Overlapping edges (same pair, multiple assets or repeated rows) merge into
 * one row. Volume is attached only when every edge for that counterparty shares
 * one asset key and all amounts are complete — cross-asset sums are never
 * computed (out of scope for this table).
 */
export function rankTopCounterparties(
  centerId: string,
  edges: readonly CounterpartyEdgeInput[],
  options: {
    nodes?: readonly CounterpartyNodeInput[];
    limit?: number;
  } = {},
): TopCounterpartiesResult {
  const configuredLimit =
    options.limit !== undefined && Number.isFinite(options.limit) && options.limit > 0
      ? Math.floor(options.limit)
      : TOP_COUNTERPARTIES_LIMIT;

  const byId = new Map<string, MutableCounterparty>();

  for (const edge of edges) {
    if (edge.source === edge.destination) continue;
    const counterpartyId =
      edge.source === centerId
        ? edge.destination
        : edge.destination === centerId
          ? edge.source
          : null;
    if (counterpartyId === null) continue;

    const existing = byId.get(counterpartyId) ?? {
      id: counterpartyId,
      label: resolveLabel(counterpartyId, options.nodes),
      category: resolveCategory(counterpartyId, options.nodes),
      operationCount: 0,
      inflowOps: 0,
      outflowOps: 0,
      assetKeys: new Set<string>(),
      volumeByAsset: new Map<string, bigint>(),
      amountComplete: true,
    };

    existing.operationCount += edge.operationCount;
    if (edge.source === centerId) {
      existing.outflowOps += edge.operationCount;
    } else {
      existing.inflowOps += edge.operationCount;
    }
    existing.assetKeys.add(edge.assetKey);
    if (edge.amountComplete === false) {
      existing.amountComplete = false;
    }
    const prev = existing.volumeByAsset.get(edge.assetKey) ?? BigInt(0);
    existing.volumeByAsset.set(edge.assetKey, prev + parseAmount(edge.amount));
    byId.set(counterpartyId, existing);
  }

  const ranked = [...byId.values()].sort(
    (a, b) => b.operationCount - a.operationCount || (a.id < b.id ? -1 : 1),
  );
  const totalCount = ranked.length;
  const limited = ranked.slice(0, Math.max(0, configuredLimit));

  const rows: RankedCounterparty[] = limited.map((entry) => {
    const row: RankedCounterparty = {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      operationCount: entry.operationCount,
      inflowOps: entry.inflowOps,
      outflowOps: entry.outflowOps,
    };
    if (entry.amountComplete && entry.assetKeys.size === 1) {
      const [assetKey] = entry.assetKeys;
      if (assetKey) {
        row.volume = {
          assetKey,
          assetCode: assetCodeFromKey(assetKey),
          amount: (entry.volumeByAsset.get(assetKey) ?? BigInt(0)).toString(),
        };
      }
    }
    return row;
  });

  const moreCount = Math.max(0, totalCount - configuredLimit);
  return {
    rows,
    totalCount,
    configuredLimit,
    hasMore: moreCount > 0,
    moreCount,
  };
}

/**
 * Fixture edges with deliberate overlaps for unit tests and DetailPanel demos:
 * - Kraken ↔ Lobstr appears twice (XLM + USDC) so volume must stay unsafe.
 * - Kraken ↔ MoneyGram is single-asset so volume is safe.
 * - An edge outside Kraken's neighborhood is ignored for a Kraken-centered rank.
 */
export const OVERLAPPING_COUNTERPARTY_FIXTURE_EDGES: CounterpartyEdgeInput[] = [
  {
    source: FIXTURE_ACCOUNTS.kraken,
    destination: FIXTURE_ACCOUNTS.lobstr,
    assetKey: "native:XLM",
    amount: "250000000",
    amountComplete: true,
    operationCount: 5,
  },
  {
    source: FIXTURE_ACCOUNTS.kraken,
    destination: FIXTURE_ACCOUNTS.lobstr,
    assetKey: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    amount: "100000000",
    amountComplete: true,
    operationCount: 3,
  },
  {
    source: FIXTURE_ACCOUNTS.moneygram,
    destination: FIXTURE_ACCOUNTS.kraken,
    assetKey: "native:XLM",
    amount: "80000000",
    amountComplete: true,
    operationCount: 2,
  },
  {
    source: FIXTURE_ACCOUNTS.lobstr,
    destination: FIXTURE_ACCOUNTS.unknownA,
    assetKey: "native:XLM",
    amount: "10000000",
    amountComplete: true,
    operationCount: 1,
  },
];
