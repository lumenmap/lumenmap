import {
  ACCOUNT_QUERY_TYPES,
  DESTINATION_QUERY_TYPES,
  TOP_ACCOUNTS_PER_TYPE,
  TOP_CONTRACT_LIMIT,
  TOP_CONTRACTS_PER_FUNCTION,
  TOP_SOROBAN_FUNCTIONS,
} from "@/lib/constants";
import { SUPPORTED_USDC_ASSET_SET } from "@/lib/assets/usdc";
import type {
  AccountRow,
  ActiveContractCountRow,
  ActiveSourceAccountsRow,
  CategoryRow,
  ContractRow,
  SorobanFunctionContractRow,
  SorobanFunctionRow,
  NativePaymentVolume,
  UsdcPaymentVolume,
  UsdcPaymentVolumeAssetRow,
} from "@/lib/types";

export interface QueryParams {
  start: string;
  end: string;
}

export const categoryQuery = `
SELECT
  type_string,
  COUNT(*) AS op_count,
  SUM(CASE WHEN asset_type = 'native' THEN CAST(amount AS FLOAT64) ELSE 0 END) AS xlm_volume
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

// Uncapped distinct count of active Soroban contracts for a period. Uses the
// same active-contract semantics as contractQuery above (same source table
// and null/empty filtering) but returns every qualifying contract_id rather
// than the top-N leaderboard, so op-count aggregation and the LIMIT are
// intentionally omitted.
export const activeContractCountQuery = `
SELECT DISTINCT
  contract_id
FROM \`crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract\`
WHERE hour_agg BETWEEN @start AND @end
  AND contract_id IS NOT NULL
  AND contract_id != ''
`;

export const accountQuery = `
WITH ranked AS (
  SELECT
    op_source_account AS account_id,
    type_string,
    COUNT(*) AS op_count,
    SUM(CASE WHEN asset_type = 'native' THEN CAST(amount AS FLOAT64) ELSE 0 END) AS xlm_volume,
    ROW_NUMBER() OVER (
      PARTITION BY type_string
      ORDER BY COUNT(*) DESC
    ) AS rank
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string IN UNNEST(@types)
  GROUP BY account_id, type_string
)
SELECT account_id, type_string, op_count, xlm_volume
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

export const nativePaymentVolumeQuery = `
SELECT
  COALESCE(
    CAST(
      SUM(
        CASE
          WHEN type_string = 'payment' AND asset_type = 'native' THEN
            IF(amount IS NULL OR amount < 0 OR IS_INF(amount) OR IS_NAN(amount), 0, amount)
          WHEN type_string IN ('path_payment_strict_receive', 'path_payment_strict_send') AND asset_type = 'native' THEN
            IF(amount IS NULL OR amount < 0 OR IS_INF(amount) OR IS_NAN(amount), 0, amount)
          WHEN type_string IN ('path_payment_strict_receive', 'path_payment_strict_send') AND source_asset_type = 'native' THEN
            IF(source_amount IS NULL OR source_amount < 0 OR IS_INF(source_amount) OR IS_NAN(source_amount), 0, source_amount)
          ELSE 0
        END
      ) AS BIGNUMERIC
    ),
    0
  ) AS volume_xlm
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
`;


export const usdcPaymentVolumeQuery = `
WITH supported_assets AS (
  SELECT code, issuer
  FROM UNNEST(@assets)
),
qualifying_payments AS (
  SELECT
    asset_code AS code,
    asset_issuer AS issuer,
    CAST(amount AS NUMERIC) AS amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string = 'payment'
    AND asset_code IS NOT NULL
    AND asset_issuer IS NOT NULL

  UNION ALL

  SELECT
    asset_code AS code,
    asset_issuer AS issuer,
    CAST(amount AS NUMERIC) AS amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string = 'path_payment_strict_receive'
    AND asset_code IS NOT NULL
    AND asset_issuer IS NOT NULL

  UNION ALL

  SELECT
    source_asset_code AS code,
    source_asset_issuer AS issuer,
    CAST(source_amount AS NUMERIC) AS amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string = 'path_payment_strict_send'
    AND source_asset_code IS NOT NULL
    AND source_asset_issuer IS NOT NULL
)
SELECT
  supported_assets.code,
  supported_assets.issuer,
  COALESCE(SUM(qualifying_payments.amount), 0) AS amount
FROM supported_assets
LEFT JOIN qualifying_payments
  ON qualifying_payments.code = supported_assets.code
  AND qualifying_payments.issuer = supported_assets.issuer
GROUP BY supported_assets.code, supported_assets.issuer
ORDER BY amount DESC
`;

export const activeDestinationCountQuery = `
SELECT COUNT(DISTINCT destination_account) AS active_destination_count
FROM (
  SELECT
    CASE type_string
      WHEN 'payment' THEN details.to
      WHEN 'path_payment_strict_receive' THEN details.to
      WHEN 'path_payment_strict_send' THEN details.to
      WHEN 'create_account' THEN details.new_account
      WHEN 'account_merge' THEN details.into
    END AS destination_account
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string IN UNNEST(@types)
)
WHERE destination_account IS NOT NULL
  AND destination_account != ''
  AND STARTS_WITH(destination_account, 'G')
`;

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
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  activeSourceAccounts: ActiveSourceAccountsRow[];
  usdcPaymentVolume: UsdcPaymentVolume;
};

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

export const latestDataTimestampQuery = `
SELECT MAX(closed_at) AS latest_timestamp
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
`;

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

export const activeSourceAccountsQuery = `
SELECT
  COUNT(DISTINCT op_source_account) AS active_accounts
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
  AND op_source_account IS NOT NULL
  AND op_source_account != ''
  AND op_source_account NOT LIKE 'M%'
`;

export function mapActiveSourceAccountsRows(
  rows: Record<string, unknown>[],
): ActiveSourceAccountsRow[] {
  return rows.map((row) => ({
    active_accounts: Number(row.active_accounts),
  }));
}
