import {
  ACCOUNT_QUERY_TYPES,
  DESTINATION_QUERY_TYPES,
  accountMetadataQuery,
  accountQuery,
  activeContractCountQuery,
  activeDestinationCountQuery,
  activeSourceAccountsQuery,
  categoryQuery,
  transactionCategoryQuery,
  contractQuery,
  latestDataTimestampQuery,
  nativePaymentVolumeQuery,
  queryRegistry,
  sorobanFunctionContractQuery,
  sorobanFunctionQuery,
  usdcPaymentVolumeQuery,
  usdcCategoryQuery,
  usdcAccountQuery,
} from "./shared-queries.mjs";
import { SUPPORTED_USDC_ASSET_SET } from "@/lib/assets/usdc";
import type {
  AccountRow,
  ActiveContractCountRow,
  ActiveSourceAccountsRow,
  CategoryRow,
  TransactionCategoryRow,
  ContractRow,
  SorobanFunctionContractRow,
  SorobanFunctionRow,
  NativePaymentVolume,
  UsdcAccountRow,
  UsdcCategoryRow,
  UsdcPaymentVolume,
  UsdcPaymentVolumeAssetRow,
} from "@/lib/types";

export {
  ACCOUNT_QUERY_TYPES,
  DESTINATION_QUERY_TYPES,
  accountMetadataQuery,
  accountQuery,
  activeContractCountQuery,
  activeDestinationCountQuery,
  activeSourceAccountsQuery,
  categoryQuery,
  transactionCategoryQuery,
  contractQuery,
  latestDataTimestampQuery,
  nativePaymentVolumeQuery,
  queryRegistry,
  sorobanFunctionContractQuery,
  sorobanFunctionQuery,
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



export function getUsdcPaymentVolumeParams(): { code: string; issuer: string }[] {
  return SUPPORTED_USDC_ASSET_SET.assets.map((asset) => ({
    code: asset.code,
    issuer: asset.issuer,
  }));
}

export type RawQueryResults = {
  categories: CategoryRow[];
  transactionCategories: TransactionCategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  activeSourceAccounts: ActiveSourceAccountsRow[];
  usdcPaymentVolume: UsdcPaymentVolume;
  usdcCategories: UsdcCategoryRow[];
  usdcAccounts: UsdcAccountRow[];
};

export function mapTransactionCategoryRows(
  rows: Record<string, unknown>[],
): TransactionCategoryRow[] {
  return rows.map((row) => ({
    type_string: String(row.type_string),
    txn_count: Number(row.txn_count),
  }));
}

export function mapCategoryRows(rows: Record<string, unknown>[]): CategoryRow[] {
  return rows.map((row) => ({
    type_string: String(row.type_string),
    op_count: Number(row.op_count),
    xlm_volume: Number(row.xlm_volume) || 0,
  }));
}

export function mapContractRows(rows: Record<string, unknown>[]): ContractRow[] {
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
