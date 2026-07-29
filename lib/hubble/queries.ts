import {
  ACCOUNT_QUERY_TYPES,
  TOP_ACCOUNTS_PER_TYPE,
  TOP_CONTRACT_LIMIT,
  TOP_CONTRACTS_PER_FUNCTION,
  TOP_SOROBAN_FUNCTIONS,
} from "@/lib/constants";
import type {
  AccountRow,
  CategoryRow,
  ContractRow,
  SorobanFunctionContractRow,
  SorobanFunctionRow,
  TransactionCountRow,
} from "@/lib/types";

export interface QueryParams {
  start: string;
  end: string;
}

export const categoryQuery = `
SELECT
  type_string,
  COUNT(*) AS op_count
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
GROUP BY type_string
ORDER BY op_count DESC
`;

export const contractQuery = `
SELECT
  contract_id,
  SUM(txn_count) AS op_count
FROM \`crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract\`
WHERE hour_agg BETWEEN @start AND @end
  AND contract_id IS NOT NULL
  AND contract_id != ''
GROUP BY contract_id
ORDER BY op_count DESC
LIMIT ${TOP_CONTRACT_LIMIT}
`;

export const accountQuery = `
WITH ranked AS (
  SELECT
    op_source_account AS account_id,
    type_string,
    COUNT(*) AS op_count,
    ROW_NUMBER() OVER (
      PARTITION BY type_string
      ORDER BY COUNT(*) DESC
    ) AS rank
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string IN UNNEST(@types)
  GROUP BY account_id, type_string
)
SELECT account_id, type_string, op_count
FROM ranked
WHERE rank <= ${TOP_ACCOUNTS_PER_TYPE}
ORDER BY type_string, op_count DESC
`;

export const sorobanFunctionQuery = `
WITH labeled AS (
  SELECT
    CASE
      WHEN soroban_operation_type = 'invoke_contract'
        AND parameters_decoded[SAFE_OFFSET(1)].type = 'Sym'
      THEN parameters_decoded[SAFE_OFFSET(1)].value
      ELSE soroban_operation_type
    END AS function_name
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations_soroban\`
  WHERE closed_at BETWEEN @start AND @end
)
SELECT
  function_name,
  COUNT(*) AS op_count
FROM labeled
WHERE function_name IS NOT NULL AND function_name != ''
GROUP BY function_name
ORDER BY op_count DESC
LIMIT ${TOP_SOROBAN_FUNCTIONS}
`;

export const sorobanFunctionContractQuery = `
WITH aggregated AS (
  SELECT
    parameters_decoded[SAFE_OFFSET(1)].value AS function_name,
    contract_id,
    COUNT(*) AS op_count
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations_soroban\`
  WHERE closed_at BETWEEN @start AND @end
    AND soroban_operation_type = 'invoke_contract'
    AND parameters_decoded[SAFE_OFFSET(1)].type = 'Sym'
    AND contract_id IS NOT NULL
    AND contract_id != ''
  GROUP BY function_name, contract_id
),
ranked AS (
  SELECT
    function_name,
    contract_id,
    op_count,
    ROW_NUMBER() OVER (
      PARTITION BY function_name
      ORDER BY op_count DESC
    ) AS rank
  FROM aggregated
)
SELECT function_name, contract_id, op_count
FROM ranked
WHERE rank <= ${TOP_CONTRACTS_PER_FUNCTION}
ORDER BY function_name, op_count DESC
`;

export const transactionCountQuery = `
SELECT
  COUNT(*) AS transaction_count
FROM \`crypto-stellar.crypto_stellar.history_transactions\`
WHERE closed_at BETWEEN @start AND @end
  AND successful = true
`;

export function getAccountQueryTypes(): string[] {
  return ACCOUNT_QUERY_TYPES;
}

export type RawQueryResults = {
  categories: CategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
};

export function mapCategoryRows(rows: Record<string, unknown>[]): CategoryRow[] {
  return rows.map((row) => ({
    type_string: String(row.type_string),
    op_count: Number(row.op_count),
  }));
}

export function mapContractRows(rows: Record<string, unknown>[]): ContractRow[] {
  return rows.map((row) => ({
    contract_id: String(row.contract_id),
    op_count: Number(row.op_count),
  }));
}

export function mapAccountRows(rows: Record<string, unknown>[]): AccountRow[] {
  return rows.map((row) => ({
    account_id: String(row.account_id),
    type_string: String(row.type_string),
    op_count: Number(row.op_count),
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

export const accountMetadataQuery = `
SELECT
  account_id,
  home_domain
FROM \`crypto-stellar.crypto_stellar_dbt.accounts_current\`
WHERE account_id IN UNNEST(@ids)
  AND home_domain IS NOT NULL
  AND home_domain != ''
`;

export function mapAccountMetadataRows(
  rows: Record<string, unknown>[],
): { account_id: string; home_domain: string }[] {
  return rows.map((row) => ({
    account_id: String(row.account_id),
    home_domain: String(row.home_domain),
  }));
}

export function mapTransactionCountRows(
  rows: Record<string, unknown>[],
): TransactionCountRow[] {
  if (rows.length === 0) {
    return [{ transaction_count: 0 }];
  }
  return rows.map((row) => ({
    transaction_count: Number(row.transaction_count) || 0,
  }));
}
