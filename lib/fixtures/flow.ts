import type { FlowTableEdge, FlowTableNode } from "@/components/dashboard/FlowDataTable";

/** Illustrative payment sample for local fixture mode; these are not ledger totals. */
export const FLOW_FIXTURE: { nodes: FlowTableNode[]; edges: FlowTableEdge[] } = {
  nodes: [
    { id: "G-FIXTURE-EXCHANGE", label: "Exchange", category: "exchange" },
    { id: "G-FIXTURE-WALLET-A", label: "Wallet A", category: "wallet" },
    { id: "G-FIXTURE-WALLET-B", label: "Wallet B", category: "wallet" },
    { id: "G-FIXTURE-ANCHOR", label: "Anchor", category: "anchor" },
    { id: "G-FIXTURE-DEX", label: "DEX", category: "defi" },
  ],
  edges: [
    { id: "flow-1", source: "G-FIXTURE-EXCHANGE", destination: "G-FIXTURE-WALLET-A", assetKey: "native:XLM", asset: { code: "XLM" }, amount: "800000000", operationCount: 8 },
    { id: "flow-2", source: "G-FIXTURE-WALLET-A", destination: "G-FIXTURE-WALLET-B", assetKey: "native:XLM", asset: { code: "XLM" }, amount: "300000000", operationCount: 4 },
    { id: "flow-3", source: "G-FIXTURE-ANCHOR", destination: "G-FIXTURE-WALLET-B", assetKey: "USDC:FIXTURE", asset: { code: "USDC" }, amount: "500000000", operationCount: 5 },
    { id: "flow-4", source: "G-FIXTURE-WALLET-B", destination: "G-FIXTURE-DEX", assetKey: "native:XLM", asset: { code: "XLM" }, amount: "200000000", operationCount: 3 },
    { id: "flow-5", source: "G-FIXTURE-DEX", destination: "G-FIXTURE-EXCHANGE", assetKey: "native:XLM", asset: { code: "XLM" }, amount: "100000000", operationCount: 2 },
  ],
};
