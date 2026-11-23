import type { FlowEdge } from "./graph";

export const SANKEY_TOP_N_PER_ASSET = 20;

export interface SankeyAssetGroup {
  asset: "XLM" | "USDC";
  assetKey: string;
  edges: FlowEdge[];
  eligibleCount: number;
  coveragePercent: number;
}

/** Rank only complete, positive payment amounts; never add unlike assets. */
export function buildSankeyGroups(edges: readonly FlowEdge[]): SankeyAssetGroup[] {
  const keys = [...new Set(edges.filter((edge) =>
    edge.assetKey === "native:XLM" ||
    (edge.assetKey.startsWith("USDC:") && edge.asset?.code === "USDC"),
  ).map((edge) => edge.assetKey))].sort((a, b) =>
    a === "native:XLM" ? -1 : b === "native:XLM" ? 1 : a.localeCompare(b),
  );
  return keys.flatMap((assetKey) => {
    const asset = assetKey === "native:XLM" ? "XLM" : "USDC";
    const eligible = edges.filter((edge) => {
      if (edge.amountComplete === false || !/^\d+$/.test(edge.amount) || BigInt(edge.amount) <= BigInt(0)) return false;
      return edge.assetKey === assetKey;
    });
    if (eligible.length === 0) return [];
    eligible.sort((a, b) => {
      const difference = BigInt(b.amount) - BigInt(a.amount);
      return difference > BigInt(0) ? 1 : difference < BigInt(0) ? -1 : a.id.localeCompare(b.id);
    });
    const selected = eligible.slice(0, SANKEY_TOP_N_PER_ASSET);
    const total = eligible.reduce((sum, edge) => sum + BigInt(edge.amount), BigInt(0));
    const shown = selected.reduce((sum, edge) => sum + BigInt(edge.amount), BigInt(0));
    return [{
      asset,
      assetKey,
      edges: selected,
      eligibleCount: eligible.length,
      coveragePercent: Number((shown * BigInt(1000)) / total) / 10,
    }];
  });
}
