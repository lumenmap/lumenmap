import type {
  FlowTableEdge,
  FlowTableNode,
} from "@/components/dashboard/FlowDataTable";

export const DEFAULT_SANKEY_TOP_N = 10;

export interface SankeyBand {
  id: string;
  sourceId: string;
  sourceLabel: string;
  assetCode: "XLM" | "USDC";
  destinationId: string;
  destinationLabel: string;
  amountStroops: string;
  operationCount: number;
  widthPercent: number;
}

export interface SankeyFlowModel {
  bands: SankeyBand[];
  topN: number;
  totalEligibleEdges: number;
  returnedEdges: number;
  coveragePercent: number;
  sampled: boolean;
  capBadgeText: string;
  coverageBadgeText: string;
}

export function resolveSankeyAssetCode(
  edge: Pick<FlowTableEdge, "assetKey" | "asset">,
): "XLM" | "USDC" | null {
  const code = edge.asset?.code?.toUpperCase();
  if (code === "XLM" || edge.assetKey === "native:XLM") {
    return "XLM";
  }
  if (code === "USDC" || edge.assetKey.toUpperCase().startsWith("USDC:")) {
    return "USDC";
  }
  return null;
}

function parseAmountNumeric(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function buildSankeyModel(
  nodes: readonly FlowTableNode[],
  edges: readonly FlowTableEdge[],
  options?: { topN?: number },
): SankeyFlowModel {
  const topN = Math.max(1, Math.floor(options?.topN ?? DEFAULT_SANKEY_TOP_N));
  const labelMap = new Map<string, string>();
  for (const node of nodes) {
    labelMap.set(node.id, node.label || node.id);
  }

  const eligible = edges
    .map((edge) => {
      const assetCode = resolveSankeyAssetCode(edge);
      if (!assetCode) return null;
      return {
        edge,
        assetCode,
        amountNum: parseAmountNumeric(edge.amount),
      };
    })
    .filter(
      (
        item,
      ): item is {
        edge: FlowTableEdge;
        assetCode: "XLM" | "USDC";
        amountNum: number;
      } => item !== null,
    );

  eligible.sort((a, b) => {
    if (b.amountNum !== a.amountNum) return b.amountNum - a.amountNum;
    if (b.edge.operationCount !== a.edge.operationCount) {
      return b.edge.operationCount - a.edge.operationCount;
    }
    return a.edge.id.localeCompare(b.edge.id);
  });

  const sliced = eligible.slice(0, topN);
  const totalOps = eligible.reduce((s, item) => s + item.edge.operationCount, 0);
  const returnedOps = sliced.reduce(
    (s, item) => s + item.edge.operationCount,
    0,
  );
  const coveragePercent =
    totalOps > 0 ? Number(((returnedOps / totalOps) * 100).toFixed(1)) : 0;
  const maxAmount = sliced.reduce(
    (max, item) => Math.max(max, item.amountNum),
    0,
  );

  const bands: SankeyBand[] = sliced.map(({ edge, assetCode, amountNum }) => ({
    id: edge.id,
    sourceId: edge.source,
    sourceLabel: labelMap.get(edge.source) ?? edge.source,
    assetCode,
    destinationId: edge.destination,
    destinationLabel: labelMap.get(edge.destination) ?? edge.destination,
    amountStroops: edge.amount,
    operationCount: edge.operationCount,
    widthPercent:
      maxAmount > 0
        ? Math.max(12, Math.round((amountNum / maxAmount) * 100))
        : 12,
  }));

  const sampled = sliced.length < eligible.length;

  return {
    bands,
    topN,
    totalEligibleEdges: eligible.length,
    returnedEdges: sliced.length,
    coveragePercent,
    sampled,
    capBadgeText: `Top ${topN} XLM/USDC cap (${sliced.length} of ${eligible.length} edges)`,
    coverageBadgeText: `${coveragePercent.toFixed(1)}% of XLM/USDC operations`,
  };
}

export const SANKEY_FIXTURE_NODES: readonly FlowTableNode[] = [
  { id: "GAAA", label: "Binance Hot Wallet", category: "exchange" },
  { id: "GBBB", label: "Soroswap Router", category: "defi" },
  { id: "GCCC", label: "Circle Treasury", category: "issuer" },
  { id: "GDDD", label: "MoneyGram Anchor", category: "anchor" },
];

export const SANKEY_FIXTURE_EDGES: readonly FlowTableEdge[] = [
  {
    id: "sankey-1",
    source: "GAAA",
    destination: "GBBB",
    assetKey: "native:XLM",
    asset: { code: "XLM" },
    amount: "85000000000",
    operationCount: 420,
  },
  {
    id: "sankey-2",
    source: "GCCC",
    destination: "GDDD",
    assetKey: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    asset: { code: "USDC" },
    amount: "64000000000",
    operationCount: 310,
  },
  {
    id: "sankey-3",
    source: "GBBB",
    destination: "GAAA",
    assetKey: "native:XLM",
    asset: { code: "XLM" },
    amount: "29000000000",
    operationCount: 185,
  },
];
