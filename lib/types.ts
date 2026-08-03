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
}

export interface TreemapNode {
  id?: string;
  name: string;
  value?: number;
  color?: string;
  children?: TreemapNode[];
  meta?: TreemapNodeMeta;
}

export interface ActivityTreemaps {
  events: TreemapNode;
  actors: TreemapNode;
}

export interface DailyActivityRow {
  date: string;
  op_count: number;
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
  dailyActivity: DailyActivityRow[];
  kpis: ActivityKpis;
  treemaps: ActivityTreemaps;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
}

export interface SelectedNode {
  name: string;
  value: number;
  share: number;
  meta?: TreemapNodeMeta;
}
