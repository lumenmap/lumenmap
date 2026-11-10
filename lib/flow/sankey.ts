import type { FlowTableEdge, FlowTableNode } from "@/components/dashboard/FlowDataTable";

export const SANKEY_ALLOWED_ASSETS = ["XLM", "USDC"] as const;
export type SankeyAllowedAsset = (typeof SANKEY_ALLOWED_ASSETS)[number];
export const DEFAULT_SANKEY_TOP_N = 10;

export interface SankeyLink {
  id: string;
  sourceId: string;
  sourceLabel: string;
  assetCode: SankeyAllowedAsset;
  destinationId: string;
  destinationLabel: string;
  amountStroops: string;
  operationCount: number;
  thickness: number;
  ySource: number;
  yAsset: number;
  yDestination: number;
}

export interface SankeyCoverage {
  returnedEdges: number;
  eligibleEdges: number;
  totalEdges: number;
  returnedOperations: number;
  eligibleOperations: number;
  coveragePercent: number;
  topN: number;
  sampled: boolean;
}

export interface SankeyFlowModel {
  links: SankeyLink[];
  sources: { id: string; label: string; y: number; operationCount: number }[];
  assets: { code: SankeyAllowedAsset; y: number; operationCount: number }[];
  destinations: { id: string; label: string; y: number; operationCount: number }[];
  coverage: SankeyCoverage;
}

export function resolveSankeyAssetCode(
  edge: Pick<FlowTableEdge, "assetKey" | "asset">,
): SankeyAllowedAsset | null {
  const code = (edge.asset?.code ?? edge.assetKey.split(":")[0] ?? "")
    .trim()
    .toUpperCase();
  if (code === "XLM" || edge.assetKey === "native:XLM") return "XLM";
  if (code === "USDC" || edge.assetKey.toUpperCase().startsWith("USDC:")) {
    return "USDC";
  }
  return null;
}

function parseAmountBigInt(amount: string): bigint {
  try {
    return BigInt(amount.trim() || "0");
  } catch {
    return 0n;
  }
}

export function buildSankeyModel(input: {
  nodes: readonly FlowTableNode[];
  edges: readonly FlowTableEdge[];
  topN?: number;
}): SankeyFlowModel {
  const topN = Math.max(1, input.topN ?? DEFAULT_SANKEY_TOP_N);
  const labelById = new Map<string, string>();
  for (const node of input.nodes) {
    labelById.set(node.id, node.label || node.id);
  }

  const eligible = input.edges
    .map((edge) => {
      const assetCode = resolveSankeyAssetCode(edge);
      return assetCode ? { edge, assetCode } : null;
    })
    .filter(
      (item): item is { edge: FlowTableEdge; assetCode: SankeyAllowedAsset } =>
        item !== null,
    );

  const sorted = [...eligible].sort((a, b) => {
    const amountDiff =
      parseAmountBigInt(b.edge.amount) - parseAmountBigInt(a.edge.amount);
    if (amountDiff !== 0n) return amountDiff > 0n ? 1 : -1;
    if (b.edge.operationCount !== a.edge.operationCount) {
      return b.edge.operationCount - a.edge.operationCount;
    }
    return a.edge.id.localeCompare(b.edge.id);
  });

  const selected = sorted.slice(0, topN);
  const eligibleOperations = eligible.reduce(
    (sum, item) => sum + item.edge.operationCount,
    0,
  );
  const returnedOperations = selected.reduce(
    (sum, item) => sum + item.edge.operationCount,
    0,
  );

  const maxOps = Math.max(
    1,
    ...selected.map((item) => item.edge.operationCount),
  );

  const sourceMap = new Map<
    string,
    { id: string; label: string; y: number; operationCount: number }
  >();
  const assetMap = new Map<
    SankeyAllowedAsset,
    { code: SankeyAllowedAsset; y: number; operationCount: number }
  >();
  const destMap = new Map<
    string,
    { id: string; label: string; y: number; operationCount: number }
  >();

  for (const { edge, assetCode } of selected) {
    const srcLabel = labelById.get(edge.source) ?? edge.source;
    const dstLabel = labelById.get(edge.destination) ?? edge.destination;

    const existingSrc = sourceMap.get(edge.source);
    if (existingSrc) {
      existingSrc.operationCount += edge.operationCount;
    } else {
      sourceMap.set(edge.source, {
        id: edge.source,
        label: srcLabel,
        y: (sourceMap.size + 1) * 48,
        operationCount: edge.operationCount,
      });
    }

    const existingAsset = assetMap.get(assetCode);
    if (existingAsset) {
      existingAsset.operationCount += edge.operationCount;
    } else {
      assetMap.set(assetCode, {
        code: assetCode,
        y: (assetMap.size + 1) * 90,
        operationCount: edge.operationCount,
      });
    }

    const existingDst = destMap.get(edge.destination);
    if (existingDst) {
      existingDst.operationCount += edge.operationCount;
    } else {
      destMap.set(edge.destination, {
        id: edge.destination,
        label: dstLabel,
        y: (destMap.size + 1) * 48,
        operationCount: edge.operationCount,
      });
    }
  }

  const links: SankeyLink[] = selected.map(({ edge, assetCode }) => {
    const src = sourceMap.get(edge.source)!;
    const ast = assetMap.get(assetCode)!;
    const dst = destMap.get(edge.destination)!;
    const thickness = Math.max(
      2,
      Math.round((edge.operationCount / maxOps) * 18),
    );
    return {
      id: edge.id,
      sourceId: edge.source,
      sourceLabel: src.label,
      assetCode,
      destinationId: edge.destination,
      destinationLabel: dst.label,
      amountStroops: edge.amount,
      operationCount: edge.operationCount,
      thickness,
      ySource: src.y,
      yAsset: ast.y,
      yDestination: dst.y,
    };
  });

  return {
    links,
    sources: [...sourceMap.values()],
    assets: [...assetMap.values()],
    destinations: [...destMap.values()],
    coverage: {
      returnedEdges: links.length,
      eligibleEdges: eligible.length,
      totalEdges: input.edges.length,
      returnedOperations,
      eligibleOperations,
      coveragePercent:
        eligibleOperations > 0
          ? Number(((returnedOperations / eligibleOperations) * 100).toFixed(1))
          : 0,
      topN,
      sampled: eligible.length > topN,
    },
  };
}

export const SANKEY_FLOW_FIXTURE: {
  nodes: FlowTableNode[];
  edges: FlowTableEdge[];
} = {
  nodes: [
    { id: "GCIRCLEANCHOR001", label: "Circle Anchor", category: "anchor" },
    { id: "GBINANCEHOT00001", label: "Binance Hot Wallet", category: "exchange" },
    { id: "GSOROSWAPROUTER1", label: "Soroswap Router", category: "dex" },
    { id: "GCOINBASEVAULT01", label: "Coinbase Custody", category: "exchange" },
  ],
  edges: [
    {
      id: "edge-xlm-1",
      source: "GBINANCEHOT00001",
      destination: "GCOINBASEVAULT01",
      assetKey: "native:XLM",
      asset: { code: "XLM" },
      amount: "9500000000000",
      operationCount: 1420,
    },
    {
      id: "edge-usdc-1",
      source: "GCIRCLEANCHOR001",
      destination: "GSOROSWAPROUTER1",
      assetKey: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      asset: { code: "USDC" },
      amount: "6400000000000",
      operationCount: 980,
    },
    {
      id: "edge-other-ignored",
      source: "GBINANCEHOT00001",
      destination: "GSOROSWAPROUTER1",
      assetKey: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
      asset: { code: "AQUA" },
      amount: "99900000000000",
      operationCount: 500,
    },
  ],
};
