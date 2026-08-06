// All time predicates use the half-open convention [start, end):
//   @start <= col AND col < @end
// This prevents double-counting boundary events across adjacent periods.
export const TOP_ACCOUNTS_PER_TYPE = 70;
export const TOP_CONTRACT_LIMIT = 200;
export const TOP_SOROBAN_FUNCTIONS = 100;
export const TOP_CONTRACTS_PER_FUNCTION = 70;

export const DESTINATION_QUERY_TYPES = [
  "payment",
  "path_payment_strict_receive",
  "path_payment_strict_send",
  "create_account",
  "account_merge",
];

export const ACCOUNT_QUERY_TYPES = [
  "payment",
  "path_payment_strict_receive",
  "path_payment_strict_send",
  "manage_buy_offer",
  "manage_sell_offer",
  "create_passive_sell_offer",
  "change_trust",
  "create_account",
  "liquidity_pool_deposit",
  "liquidity_pool_withdraw",
];

export const categoryQuery = `
SELECT
  type_string,
  COUNT(*) AS op_count,
  SUM(CASE WHEN asset_type = 'native' THEN CAST(amount AS FLOAT64) ELSE 0 END) AS xlm_volume
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE @start <= closed_at AND closed_at < @end
GROUP BY type_string
ORDER BY op_count DESC
`;

export const transactionCategoryQuery = `
SELECT
  type_string,
  COUNT(DISTINCT transaction_hash) AS txn_count
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE @start <= closed_at AND closed_at < @end
GROUP BY type_string
ORDER BY txn_count DESC
`;

export const contractQuery = `
SELECT
  contract_id,
  SUM(txn_count) AS op_count
FROM \`crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract\`
WHERE @start <= hour_agg AND hour_agg < @end
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
WHERE @start <= hour_agg AND hour_agg < @end
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
  WHERE @start <= closed_at AND closed_at < @end
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
  WHERE @start <= closed_at AND closed_at < @end
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
  WHERE @start <= closed_at AND closed_at < @end
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
WHERE @start <= closed_at AND closed_at < @end
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
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string = 'payment'
    AND asset_code IS NOT NULL
    AND asset_issuer IS NOT NULL

  UNION ALL

  SELECT
    asset_code AS code,
    asset_issuer AS issuer,
    CAST(amount AS NUMERIC) AS amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string = 'path_payment_strict_receive'
    AND asset_code IS NOT NULL
    AND asset_issuer IS NOT NULL

  UNION ALL

  SELECT
    source_asset_code AS code,
    source_asset_issuer AS issuer,
    CAST(source_amount AS NUMERIC) AS amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end
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
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string IN UNNEST(@types)
)
WHERE destination_account IS NOT NULL
  AND destination_account != ''
  AND STARTS_WITH(destination_account, 'G')
`;

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

export const activeSourceAccountsQuery = `
SELECT
  COUNT(DISTINCT op_source_account) AS active_accounts
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE @start <= closed_at AND closed_at < @end
  AND op_source_account IS NOT NULL
  AND op_source_account != ''
  AND op_source_account NOT LIKE 'M%'
`;


// Category-level USDC payment volume for treemap tiles (verified asset set only).
export const usdcCategoryQuery = `
SELECT
  type_string,
  SUM(usdc_amount) AS amount
FROM (
  SELECT
    type_string,
    CASE
      WHEN type_string = 'payment'
        AND asset_code = 'USDC'
        AND STRUCT(asset_code AS code, asset_issuer AS issuer) IN UNNEST(@assets)
      THEN CAST(amount AS NUMERIC)

      WHEN type_string IN ('path_payment_strict_receive', 'path_payment_strict_send')
        AND dest_asset_code = 'USDC'
        AND STRUCT(dest_asset_code AS code, dest_asset_issuer AS issuer) IN UNNEST(@assets)
      THEN CAST(COALESCE(dest_amount, amount) AS NUMERIC)

      WHEN type_string IN ('path_payment_strict_receive', 'path_payment_strict_send')
        AND source_asset_code = 'USDC'
        AND STRUCT(source_asset_code AS code, source_asset_issuer AS issuer) IN UNNEST(@assets)
      THEN CAST(source_amount AS NUMERIC)

      ELSE 0
    END AS usdc_amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string IN ('payment', 'path_payment_strict_receive', 'path_payment_strict_send')
)
WHERE usdc_amount > 0
GROUP BY type_string
ORDER BY amount DESC
`;

export const usdcAccountQuery = `
WITH usdc_ops AS (
  SELECT
    op_source_account AS account_id,
    type_string,
    CASE
      WHEN type_string = 'payment'
        AND asset_code = 'USDC'
        AND STRUCT(asset_code AS code, asset_issuer AS issuer) IN UNNEST(@assets)
      THEN CAST(amount AS NUMERIC)

      WHEN type_string IN ('path_payment_strict_receive', 'path_payment_strict_send')
        AND dest_asset_code = 'USDC'
        AND STRUCT(dest_asset_code AS code, dest_asset_issuer AS issuer) IN UNNEST(@assets)
      THEN CAST(COALESCE(dest_amount, amount) AS NUMERIC)

      WHEN type_string IN ('path_payment_strict_receive', 'path_payment_strict_send')
        AND source_asset_code = 'USDC'
        AND STRUCT(source_asset_code AS code, source_asset_issuer AS issuer) IN UNNEST(@assets)
      THEN CAST(source_amount AS NUMERIC)

      ELSE 0
    END AS usdc_amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string IN ('payment', 'path_payment_strict_receive', 'path_payment_strict_send')
),
aggregated AS (
  SELECT
    account_id,
    type_string,
    SUM(usdc_amount) AS amount
  FROM usdc_ops
  WHERE usdc_amount > 0
  GROUP BY account_id, type_string
),
ranked AS (
  SELECT
    account_id,
    type_string,
    amount,
    ROW_NUMBER() OVER (
      PARTITION BY type_string
      ORDER BY amount DESC
    ) AS rank
  FROM aggregated
)
SELECT account_id, type_string, amount
FROM ranked
WHERE rank <= ${TOP_ACCOUNTS_PER_TYPE}
ORDER BY type_string, amount DESC
`;

/** @type {{ name: string, sql: string, requiredParams: string[] }[]} */
export const queryRegistry = [
  { name: "categoryQuery", sql: categoryQuery, requiredParams: ["start", "end"] },
  { name: "transactionCategoryQuery", sql: transactionCategoryQuery, requiredParams: ["start", "end"] },
  { name: "contractQuery", sql: contractQuery, requiredParams: ["start", "end"] },
  { name: "activeContractCountQuery", sql: activeContractCountQuery, requiredParams: ["start", "end"] },
  { name: "accountQuery", sql: accountQuery, requiredParams: ["start", "end", "types"] },
  { name: "sorobanFunctionQuery", sql: sorobanFunctionQuery, requiredParams: ["start", "end"] },
  { name: "sorobanFunctionContractQuery", sql: sorobanFunctionContractQuery, requiredParams: ["start", "end"] },
  { name: "nativePaymentVolumeQuery", sql: nativePaymentVolumeQuery, requiredParams: ["start", "end"] },
  { name: "usdcPaymentVolumeQuery", sql: usdcPaymentVolumeQuery, requiredParams: ["start", "end", "assets"] },
  { name: "activeDestinationCountQuery", sql: activeDestinationCountQuery, requiredParams: ["start", "end", "types"] },
  { name: "latestDataTimestampQuery", sql: latestDataTimestampQuery, requiredParams: [] },
  { name: "accountMetadataQuery", sql: accountMetadataQuery, requiredParams: ["ids"] },
  { name: "activeSourceAccountsQuery", sql: activeSourceAccountsQuery, requiredParams: ["start", "end"] },
  { name: "usdcCategoryQuery", sql: usdcCategoryQuery, requiredParams: ["start", "end", "assets"] },
  { name: "usdcAccountQuery", sql: usdcAccountQuery, requiredParams: ["start", "end", "assets"] },
];
