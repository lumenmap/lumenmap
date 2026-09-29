import {
  assetPaymentVolumeQuery,
  ACCOUNT_QUERY_TYPES,
  DESTINATION_QUERY_TYPES,
  accountMetadataQuery,
  accountQuery,
  activeContractCountQuery,
  activeDestinationCountQuery,
  activeSourceAccountsQuery,
  categoryQuery,
  contractQuery,
  flowEdgeQuery,
  heatmapQuery,
  latestDataTimestampQuery,
  nativePaymentVolumeQuery,
  queryRegistry,
  sorobanFunctionContractQuery,
  sorobanFunctionQuery,
  transactionCategoryQuery,
  usdcPaymentVolumeQuery,
  usdcCategoryQuery,
  usdcAccountQuery,
} from "./shared-queries.mjs";
import { SUPPORTED_USDC_ASSET_SET } from "@/lib/assets/usdc";
import type {
  AssetPaymentVolumeRow,
  AccountRow,
  ActiveContractCountRow,
  ActiveDestinationCountRow,
  ActiveSourceAccountsRow,
  CategoryRow,
  ContractRow,
  SorobanFunctionContractRow,
  SorobanFunctionRow,
  NativePaymentVolume,
  TransactionCategoryRow,
  UsdcAccountRow,
  UsdcCategoryRow,
  UsdcPaymentVolume,
  UsdcPaymentVolumeAssetRow,
  TimeseriesRawRow,
  HeatmapRawRow,
} from "@/lib/types";

export {
  assetPaymentVolumeQuery,
  ACCOUNT_QUERY_TYPES,
  DESTINATION_QUERY_TYPES,
  accountMetadataQuery,
  accountQuery,
  activeContractCountQuery,
  activeDestinationCountQuery,
  activeSourceAccountsQuery,
  categoryQuery,
  contractQuery,
  flowEdgeQuery,
  heatmapQuery,
  latestDataTimestampQuery,
  nativePaymentVolumeQuery,
  queryRegistry,
  sorobanFunctionContractQuery,
  sorobanFunctionQuery,
  transactionCategoryQuery,
  usdcPaymentVolumeQuery,
  usdcCategoryQuery,
  usdcAccountQuery,
  TOP_ACCOUNTS_PER_TYPE,
  TOP_CONTRACT_LIMIT,
  TOP_CONTRACTS_PER_FUNCTION,
  TOP_SOROBAN_FUNCTIONS,
} from "./shared-queries.mjs";

export interface QueryParams {
  start: string;
  end: string;
}

export function getDestinationQueryTypes(): string[] {
  return DESTINATION_QUERY_TYPES;
}

export function getAccountQueryTypes(): string[] {
  return ACCOUNT_QUERY_TYPES;
}

export function getUsdcPaymentVolumeParams(): {
  code: string;
  issuer: string;
}[] {
  return SUPPORTED_USDC_ASSET_SET.assets.map((asset) => ({
    code: asset.code,
    issuer: asset.issuer,
  }));
}

export const hourlyTimeseriesQuery = `
SELECT
  TIMESTAMP_TRUNC(closed_at, HOUR) AS bucket_time,
  COUNT(DISTINCT transaction_id) AS tx_count,
  COUNT(*) AS op_count,
  COUNTIF(type_string = 'invoke_host_function') AS soroban_op_count
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
GROUP BY bucket_time
ORDER BY bucket_time ASC
`;

export const dailyTimeseriesQuery = `
SELECT
  TIMESTAMP_TRUNC(closed_at, DAY) AS bucket_time,
  COUNT(DISTINCT transaction_id) AS tx_count,
  COUNT(*) AS op_count,
  COUNTIF(type_string = 'invoke_host_function') AS soroban_op_count
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
GROUP BY bucket_time
ORDER BY bucket_time ASC
`;

export function mapTimeseriesRows(
  rows: Record<string, unknown>[],
): TimeseriesRawRow[] {
  return rows.map((row) => ({
    bucket_time:
      row.bucket_time &&
      typeof row.bucket_time === "object" &&
      "value" in row.bucket_time
        ? String((row.bucket_time as { value: string }).value)
        : String(row.bucket_time ?? ""),
    tx_count: Number(row.tx_count ?? 0),
    op_count: Number(row.op_count ?? 0),
    soroban_op_count: Number(row.soroban_op_count ?? 0),
  }));
}

export function mapHeatmapRows(
  rows: Record<string, unknown>[],
): HeatmapRawRow[] {
  return rows.map((row) => ({
    day_of_week: Number(row.day_of_week),
    hour_of_day: Number(row.hour_of_day),
    tx_count: Number(row.tx_count ?? 0),
    op_count: Number(row.op_count ?? 0),
  }));
}

export type RawQueryResults = {
  assetVolumes: AssetPaymentVolumeRow[];
  timeseries: TimeseriesRawRow[];
  categories: CategoryRow[];
  transactionCategories: TransactionCategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  activeSourceAccounts: ActiveSourceAccountsRow[];
  activeDestinationCount: ActiveDestinationCountRow;
  usdcPaymentVolume: UsdcPaymentVolume;
  usdcCategories: UsdcCategoryRow[];
  usdcAccounts: UsdcAccountRow[];
  heatmap: HeatmapRawRow[];
};

export function mapAssetPaymentVolumeRows(
  rows: Record<string, unknown>[],
): AssetPaymentVolumeRow[] {
  return rows
    .map((row) => ({
      asset:
        String(row.asset_type) === "native"
          ? ({ type: "native", code: "XLM" } as const)
          : ({
              type: "issued",
              code: String(row.asset_code),
              issuer: String(row.asset_issuer),
            } as const),
      amount: String(row.amount ?? "0"),
      opCount: Number(row.op_count ?? 0),
    }))
    .filter((row) => Number(row.amount) > 0);
}

export function mapCategoryRows(
  rows: Record<string, unknown>[],
): CategoryRow[] {
  return rows.map((row) => ({
    type_string: String(row.type_string),
    op_count: Number(row.op_count),
    xlm_volume: Number(row.xlm_volume) || 0,
  }));
}

export function mapTransactionCategoryRows(
  rows: Record<string, unknown>[],
): TransactionCategoryRow[] {
  return rows.map((row) => ({
    type_string: String(row.type_string),
    txn_count: Number(row.txn_count),
  }));
}

export function mapContractRows(
  rows: Record<string, unknown>[],
): ContractRow[] {
  return rows.map((row) => ({
    contract_id: String(row.contract_id),
    op_count: Number(row.op_count),
  }));
}

// Defensively dedupes and drops null/empty contract IDs client-side, in
// addition to the query's own DISTINCT and WHERE filters, so a qualifying
// contract ID contributes at most once even if upstream ever returns
// duplicate or malformed rows.
export function mapActiveContractCountRow(
  rows: Record<string, unknown>[],
): ActiveContractCountRow {
  const ids = new Set<string>();

  for (const row of rows) {
    const id = row.contract_id;
    if (typeof id === "string" && id.length > 0) {
      ids.add(id);
    }
  }

  return { active_contract_count: ids.size };
}

export function mapAccountRows(rows: Record<string, unknown>[]): AccountRow[] {
  return rows.map((row) => ({
    account_id: String(row.account_id),
    type_string: String(row.type_string),
    op_count: Number(row.op_count),
    xlm_volume: Number(row.xlm_volume) || 0,
  }));
}

export function mapSorobanFunctionRows(
  rows: Record<string, unknown>[],
): SorobanFunctionRow[] {
  return rows.map((row) => ({
    function_name: String(row.function_name),
    op_count: Number(row.op_count),
  }));
}

export function mapSorobanFunctionContractRows(
  rows: Record<string, unknown>[],
): SorobanFunctionContractRow[] {
  return rows.map((row) => ({
    function_name: String(row.function_name),
    contract_id: String(row.contract_id),
    op_count: Number(row.op_count),
  }));
}

export function mapUsdcPaymentVolumeRows(
  rows: Record<string, unknown>[],
): UsdcPaymentVolume {
  const assets: UsdcPaymentVolumeAssetRow[] = rows.map((row) => ({
    asset: {
      code: String(row.code),
      issuer: String(row.issuer),
    },
    amount: Number(row.amount ?? 0),
  }));

  return {
    amount: assets.reduce((sum, row) => sum + row.amount, 0),
    unit: "USDC",
    assetSetId: SUPPORTED_USDC_ASSET_SET.id,
    methodology: SUPPORTED_USDC_ASSET_SET.methodology,
    assets,
  };
}

export function mapUsdcCategoryRows(
  rows: Record<string, unknown>[],
): UsdcCategoryRow[] {
  return rows.map((row) => ({
    type_string: String(row.type_string),
    amount: Number(row.amount),
  }));
}

export function mapUsdcAccountRows(
  rows: Record<string, unknown>[],
): UsdcAccountRow[] {
  return rows.map((row) => ({
    account_id: String(row.account_id),
    type_string: String(row.type_string),
    amount: Number(row.amount),
  }));
}

export function mapNativePaymentVolumeRow(
  rows: Record<string, unknown>[],
): NativePaymentVolume {
  const first = rows[0];
  const value = first?.volume_xlm != null ? String(first.volume_xlm) : "0";
  return {
    amount: value,
    unit: "XLM",
  };
}

export function mapAccountMetadataRows(
  rows: Record<string, unknown>[],
): { account_id: string; home_domain: string }[] {
  return rows.map((row) => ({
    account_id: String(row.account_id),
    home_domain: String(row.home_domain),
  }));
}

export function mapActiveSourceAccountsRows(
  rows: Record<string, unknown>[],
): ActiveSourceAccountsRow[] {
  return rows.map((row) => ({
    active_accounts: Number(row.active_accounts),
  }));
}

export function mapActiveDestinationCountRow(
  rows: Record<string, unknown>[],
): ActiveDestinationCountRow {
  return {
    active_destination_count:
      rows.length > 0 ? Number(rows[0].active_destination_count) : 0,
  };
}

export interface FlowEdgeRow {
  source_account: string;
  destination_account: string;
  asset_key: string;
  asset_code: string;
  asset_issuer: string | null;
  amount: string;
  operation_count: number;
}

export function mapFlowEdgeRows(
  rows: Record<string, unknown>[],
): FlowEdgeRow[] {
  return rows.map((row) => ({
    source_account: typeof row.source_account === "string" ? row.source_account : "",
    destination_account: typeof row.destination_account === "string" ? row.destination_account : "",
    asset_key: typeof row.asset_key === "string" ? row.asset_key : "",
    asset_code: typeof row.asset_code === "string" ? row.asset_code : "",
    asset_issuer: typeof row.asset_issuer === "string" ? row.asset_issuer : null,
    amount: typeof row.amount === "string" ? row.amount : "0",
    operation_count: Number(row.operation_count ?? 0),
  }));
}
