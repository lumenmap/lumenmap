export type Period = "1d" | "7d" | "30d" | "month";

export type DataSource = "hubble";

export type TreemapNodeType =
  | "root"
  | "category"
  | "entity"
  | "contract"
  | "account";

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
  /**
   * Uncapped distinct active Soroban contracts for the period.
   * Not derived from the capped `contracts` leaderboard length.
   */
  activeContracts: number;
}

/** Provenance for Active Contracts: uncapped COUNT(DISTINCT contract_id). */
export interface ActiveContractsProvenance {
  metric: "activeContracts";
  aggregation: "uncapped_distinct_count";
  source: "hourly_soroban_fee_agg_contract";
  query: "activeContractCountQuery";
  /** Independent cap applied only to `contracts` leaderboard / treemap rows. */
  leaderboardLimit: number;
}

export interface ActivityProvenance {
  activeContracts: ActiveContractsProvenance;
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
}

export interface ActivityResponse {
  period: Period;
  start: string;
  end: string;
  source: DataSource;
  categories: CategoryRow[];
  /** Top contracts for leaderboard / treemap (capped at TOP_CONTRACT_LIMIT). */
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  /**
   * Uncapped distinct active-contract aggregate for the period.
   * Source of `kpis.activeContracts`; independent of `contracts.length`.
   */
  activeContractCount: number;
  kpis: ActivityKpis;
  provenance: ActivityProvenance;
  treemaps: ActivityTreemaps;
}

export interface SelectedNode {
  name: string;
  value: number;
  share: number;
  meta?: TreemapNodeMeta;
}
