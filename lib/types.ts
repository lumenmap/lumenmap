export type Period = "1d" | "7d" | "30d" | "month";

export type DataSource = "hubble";

export type TreemapNodeType =
  | "root"
  | "category"
  | "entity"
  | "contract"
  | "account"
  | "protocol";

export interface EntityInfo {
  name: string;
  category: string;
  protocol: string;
}

export interface CategoryRow {
  type_string: string;
  op_count: number;
}

export interface ContractRow {
  contract_id: string;
  op_count: number;
}

export interface AccountRow {
  account_id: string;
  type_string: string;
  op_count: number;
}

export interface SorobanFunctionRow {
  function_name: string;
  op_count: number;
}

export interface SorobanFunctionContractRow {
  function_name: string;
  contract_id: string;
  op_count: number;
}

export interface ActivityKpis {
  totalOps: number;
  sorobanShare: number;
  topCategory: string;
  activeContracts: number;
}

export interface TreemapNodeMeta {
  type: TreemapNodeType;
  id?: string;
  category?: string;
  protocol?: string;
  share?: number;
  opCount?: number;
  childCount?: number;
  eventType?: string;
  tvlUsd?: number;
  snapshotTime?: string;
  status?: AdapterStatus;
  confidence?: number;
  source?: string;
  totalTVL?: number;
  protocolCount?: number;
}

export interface TreemapNode {
  id?: string;
  name: string;
  value?: number;
  color?: string;
  children?: TreemapNode[];
  meta?: TreemapNodeMeta;
}

import type { TreemapViewId } from "@/lib/constants";

export interface ActivityTreemaps {
  events: TreemapNode;
  actors: TreemapNode;
  protocols?: TreemapNode;
}

export interface ActivityResponse {
  period: Period;
  start: string;
  end: string;
  source: DataSource;
  categories: CategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  kpis: ActivityKpis;
  treemaps: ActivityTreemaps;
}

export interface SelectedNode {
  name: string;
  value: number;
  share: number;
  meta?: TreemapNodeMeta;
}

export type AdapterStatus = "valid" | "partial" | "stale" | "invalid";

export interface ProtocolSnapshot {
  protocol: string;
  tvlUsd: number;
  snapshotTime: string;
  status: AdapterStatus;
  metadata?: {
    source?: string;
    lastUpdated?: string;
    confidence?: number;
  };
}

export interface ProtocolAdapter {
  protocolId: string;
  protocolName: string;
  fetchTVL: () => Promise<ProtocolSnapshot>;
  validate: () => AdapterStatus;
}
