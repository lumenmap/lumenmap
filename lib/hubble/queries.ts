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

export function getAccountQueryTypes(): string[] {
  return ACCOUNT_QUERY_TYPES;
}

// ---------------------------------------------------------------------------
// Validation helpers for BigQuery row values
// ---------------------------------------------------------------------------

/**
 * Unwrap a BigQuery numeric wrapper if present (e.g. { value: 42 }),
 * otherwise return the value as-is.
 */
function unwrapNumeric(value: unknown): unknown {
  if (
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in (value as Record<string, unknown>)
  ) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

/**
 * Extract a non-empty string identifier from a row field.
 * Throws if the field is null, undefined, or an empty string.
 */
function requireStringField(
  row: Record<string, unknown>,
  field: string,
): string {
  const raw = row[field];
  if (raw === null || raw === undefined) {
    throw new Error(
      `Row mapper: missing required string field "${field}" (got ${String(raw)})`,
    );
  }
  const str = String(raw);
  if (str === "") {
    throw new Error(
      `Row mapper: field "${field}" must not be empty`,
    );
  }
  return str;
}

/**
 * Extract a non-empty string from a row field that may be empty (e.g. type labels).
 * Returns the string or an empty string. Throws only on null/undefined.
 */
function optionalStringField(
  row: Record<string, unknown>,
  field: string,
): string {
  const raw = row[field];
  if (raw === null || raw === undefined) {
    throw new Error(
      `Row mapper: missing required string field "${field}" (got ${String(raw)})`,
    );
  }
  return String(raw);
}

/**
 * Extract a finite, non-NaN number from a row field.
 * Supports BigQuery numeric wrappers (objects with a `value` property).
 * Throws if value is null, undefined, NaN, Infinity, or not coercible to a
 * finite number.
 */
function requireFiniteNumber(
  row: Record<string, unknown>,
  field: string,
): number {
  const raw = unwrapNumeric(row[field]);
  if (raw === null || raw === undefined) {
    throw new Error(
      `Row mapper: missing required numeric field "${field}" (got ${String(raw)})`,
    );
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    throw new Error(
      `Row mapper: field "${field}" must be a finite number (got ${String(raw)})`,
    );
  }
  return num;
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
    type_string: optionalStringField(row, "type_string"),
    op_count: requireFiniteNumber(row, "op_count"),
  }));
}

export function mapContractRows(rows: Record<string, unknown>[]): ContractRow[] {
  return rows.map((row) => ({
    contract_id: requireStringField(row, "contract_id"),
    op_count: requireFiniteNumber(row, "op_count"),
  }));
}

export function mapAccountRows(rows: Record<string, unknown>[]): AccountRow[] {
  return rows.map((row) => ({
    account_id: requireStringField(row, "account_id"),
    type_string: optionalStringField(row, "type_string"),
    op_count: requireFiniteNumber(row, "op_count"),
  }));
}

export function mapSorobanFunctionRows(
  rows: Record<string, unknown>[],
): SorobanFunctionRow[] {
  return rows.map((row) => ({
    function_name: optionalStringField(row, "function_name"),
    op_count: requireFiniteNumber(row, "op_count"),
  }));
}

export function mapSorobanFunctionContractRows(
  rows: Record<string, unknown>[],
): SorobanFunctionContractRow[] {
  return rows.map((row) => ({
    function_name: optionalStringField(row, "function_name"),
    contract_id: requireStringField(row, "contract_id"),
    op_count: requireFiniteNumber(row, "op_count"),
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
    account_id: requireStringField(row, "account_id"),
    home_domain: optionalStringField(row, "home_domain"),
  }));
}
