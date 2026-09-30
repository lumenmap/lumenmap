// All time predicates use the half-open convention [start, end):
//   @start <= col AND col < @end
// This prevents double-counting boundary events across adjacent periods.
export const TOP_ACCOUNTS_PER_TYPE = 70;
export const TOP_CONTRACT_LIMIT = 200;
export const TOP_SOROBAN_FUNCTIONS = 100;
export const TOP_CONTRACTS_PER_FUNCTION = 70;
/** Max payment-flow edges returned per period (ranked sample, not a full ledger). */
export const TOP_PAYMENT_FLOW_EDGES = 200;
/** Max host functions listed per contract in the detail panel. */
export const TOP_FUNCTIONS_PER_CONTRACT = 15;

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

export const assetPaymentVolumeQuery = `
WITH qualifying_payments AS (
  SELECT asset_type, asset_code, asset_issuer, amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end AND type_string = 'payment'
  UNION ALL
  SELECT asset_type, asset_code, asset_issuer, amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end AND type_string = 'path_payment_strict_receive'
  UNION ALL
  SELECT source_asset_type, source_asset_code, source_asset_issuer, source_amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end AND type_string = 'path_payment_strict_send'
)
SELECT
  asset_type,
  IF(asset_type = 'native', 'XLM', asset_code) AS asset_code,
  asset_issuer,
  CAST(SUM(IF(amount IS NULL OR amount < 0 OR IS_INF(amount) OR IS_NAN(amount), 0, amount)) AS STRING) AS amount,
  COUNTIF(amount IS NOT NULL AND amount >= 0 AND NOT IS_INF(amount) AND NOT IS_NAN(amount)) AS op_count
FROM qualifying_payments
WHERE asset_type = 'native' OR (asset_code IS NOT NULL AND asset_issuer IS NOT NULL)
GROUP BY asset_type, asset_code, asset_issuer
ORDER BY SAFE_CAST(amount AS BIGNUMERIC) DESC
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
      WHEN 'payment' THEN \`to\`
      WHEN 'path_payment_strict_receive' THEN \`to\`
      WHEN 'path_payment_strict_send' THEN \`to\`
      WHEN 'create_account' THEN account
      WHEN 'account_merge' THEN \`into\`
    END AS destination_account
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string IN UNNEST(@types)
)
WHERE destination_account IS NOT NULL
  AND destination_account != ''
  AND STARTS_WITH(destination_account, 'G')
`;

export const heatmapQuery = `
SELECT
  EXTRACT(DAYOFWEEK FROM closed_at) AS day_of_week,
  EXTRACT(HOUR FROM closed_at) AS hour_of_day,
  COUNT(DISTINCT transaction_id) AS tx_count,
  COUNT(*) AS op_count
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE @start <= closed_at AND closed_at < @end
GROUP BY day_of_week, hour_of_day
`;

// Flow edge query: aggregates payment operations into edges by source, destination, and asset.
// Asset mode is controlled by @assetMode parameter: "xlm", "usdc", or "op_count".
// Never mixes heterogeneous assets - each edge is denominated in exactly one asset.
export const flowEdgeQuery = `
WITH qualifying_ops AS (
  SELECT
    op_source_account AS source_account,
    CASE type_string
      WHEN 'payment' THEN details.to
      WHEN 'path_payment_strict_receive' THEN details.to
      WHEN 'path_payment_strict_send' THEN details.to
      WHEN 'create_account' THEN details.new_account
      WHEN 'account_merge' THEN details.into
    END AS destination_account,
    type_string,
    asset_type,
    asset_code,
    asset_issuer,
    source_asset_type,
    source_asset_code,
    source_asset_issuer,
    amount,
    source_amount,
    dest_asset_code,
    dest_asset_issuer,
    dest_amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string IN ('payment', 'path_payment_strict_receive', 'path_payment_strict_send', 'create_account', 'account_merge')
    AND op_source_account IS NOT NULL
    AND op_source_account != ''
    AND STARTS_WITH(op_source_account, 'G')
),
filtered_ops AS (
  SELECT
    source_account,
    destination_account,
    type_string,
    CASE
      -- XLM mode: only native XLM amounts
      WHEN @assetMode = 'xlm' THEN
        CASE
          WHEN type_string = 'payment' AND asset_type = 'native' THEN amount
          WHEN type_string = 'path_payment_strict_receive' AND asset_type = 'native' THEN amount
          WHEN type_string = 'path_payment_strict_send' AND source_asset_type = 'native' THEN source_amount
          WHEN type_string = 'create_account' AND asset_type = 'native' THEN amount
          WHEN type_string = 'account_merge' AND asset_type = 'native' THEN amount
          ELSE NULL
        END
      -- USDC mode: only verified USDC issuers
      WHEN @assetMode = 'usdc' THEN
        CASE
          WHEN type_string = 'payment'
            AND asset_code = 'USDC'
            AND STRUCT(asset_code AS code, asset_issuer AS issuer) IN UNNEST(@assets)
          THEN amount
          WHEN type_string = 'path_payment_strict_receive'
            AND dest_asset_code = 'USDC'
            AND STRUCT(dest_asset_code AS code, dest_asset_issuer AS issuer) IN UNNEST(@assets)
          THEN COALESCE(dest_amount, amount)
          WHEN type_string = 'path_payment_strict_send'
            AND source_asset_code = 'USDC'
            AND STRUCT(source_asset_code AS code, source_asset_issuer AS issuer) IN UNNEST(@assets)
          THEN source_amount
          ELSE NULL
        END
      -- op_count mode: no amount filtering, count operations only
      ELSE NULL
    END AS edge_amount,
    CASE
      WHEN @assetMode = 'op_count' THEN 1
      ELSE 0
    END AS op_count_flag
  FROM qualifying_ops
  WHERE destination_account IS NOT NULL
    AND destination_account != ''
    AND STARTS_WITH(destination_account, 'G')
    AND source_account != destination_account
),
asset_keyed_ops AS (
  SELECT
    source_account,
    destination_account,
    CASE @assetMode
      WHEN 'xlm' THEN 'native:XLM'
      WHEN 'usdc' THEN 'issued:USDC'
      ELSE 'op_count'
    END AS asset_key,
    CASE @assetMode
      WHEN 'xlm' THEN 'XLM'
      WHEN 'usdc' THEN 'USDC'
      ELSE 'op_count'
    END AS asset_code,
    CASE @assetMode
      WHEN 'xlm' THEN NULL
      WHEN 'usdc' THEN NULL
      ELSE NULL
    END AS asset_issuer,
    edge_amount,
    op_count_flag
  FROM filtered_ops
  WHERE (@assetMode = 'op_count' AND op_count_flag = 1)
    OR (@assetMode != 'op_count' AND edge_amount IS NOT NULL AND edge_amount > 0)
)
SELECT
  source_account,
  destination_account,
  asset_key,
  asset_code,
  asset_issuer,
  CASE @assetMode
    WHEN 'op_count' THEN COUNT(*)
    ELSE CAST(SUM(IF(edge_amount IS NULL OR edge_amount < 0 OR IS_INF(edge_amount) OR IS_NAN(edge_amount), 0, edge_amount)) AS STRING)
  END AS amount,
  COUNT(*) AS operation_count
FROM asset_keyed_ops
GROUP BY source_account, destination_account, asset_key, asset_code, asset_issuer
ORDER BY operation_count DESC, SAFE_CAST(amount AS BIGNUMERIC) DESC
LIMIT 1000
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

// Aggregated payment-flow edges for a period: one row per
// (source, destination, asset) collapsing payment, path-payment (destination
// leg), create_account funding, and account_merge drain operations. Follows
// docs/metric-methodology.md "Payment-flow graph": successful ops only,
// self-payments and missing endpoints excluded, asset identity is code +
// issuer (native XLM explicit), ranked op_count then amount with LIMIT.
export const paymentFlowEdgesQuery = `
WITH base AS (
  SELECT
    op_source_account AS from_account,
    CASE type_string
      WHEN 'payment' THEN details.to
      WHEN 'path_payment_strict_receive' THEN details.to
      WHEN 'path_payment_strict_send' THEN details.to
      WHEN 'create_account' THEN details.new_account
      WHEN 'account_merge' THEN details.into
    END AS to_account,
    CASE type_string
      WHEN 'payment' THEN asset_type
      WHEN 'path_payment_strict_receive' THEN IF(dest_asset_issuer IS NULL, 'native', 'credit_alphanum4')
      WHEN 'path_payment_strict_send' THEN IF(dest_asset_issuer IS NULL, 'native', 'credit_alphanum4')
      WHEN 'create_account' THEN 'native'
      WHEN 'account_merge' THEN 'native'
    END AS edge_asset_type,
    CASE type_string
      WHEN 'payment' THEN IF(asset_type = 'native', 'XLM', asset_code)
      WHEN 'path_payment_strict_receive' THEN COALESCE(dest_asset_code, 'XLM')
      WHEN 'path_payment_strict_send' THEN COALESCE(dest_asset_code, 'XLM')
      WHEN 'create_account' THEN 'XLM'
      WHEN 'account_merge' THEN 'XLM'
    END AS edge_asset_code,
    CASE type_string
      WHEN 'payment' THEN asset_issuer
      WHEN 'path_payment_strict_receive' THEN dest_asset_issuer
      WHEN 'path_payment_strict_send' THEN dest_asset_issuer
      ELSE NULL
    END AS edge_asset_issuer,
    CASE type_string
      WHEN 'payment' THEN amount
      WHEN 'path_payment_strict_receive' THEN COALESCE(dest_amount, amount)
      WHEN 'path_payment_strict_send' THEN COALESCE(dest_amount, amount)
      WHEN 'create_account' THEN details.starting_balance
      WHEN 'account_merge' THEN COALESCE(amount, 0)
    END AS edge_amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string IN ('payment', 'path_payment_strict_receive', 'path_payment_strict_send', 'create_account', 'account_merge')
    AND (successful IS NULL OR successful = TRUE)
),
filtered AS (
  SELECT from_account, to_account, edge_asset_type, edge_asset_code, edge_asset_issuer, edge_amount
  FROM base
  WHERE from_account IS NOT NULL AND from_account != ''
    AND STARTS_WITH(from_account, 'G')
    AND to_account IS NOT NULL AND to_account != ''
    AND STARTS_WITH(to_account, 'G')
    AND from_account != to_account
    AND edge_amount IS NOT NULL
    AND edge_amount >= 0
    AND NOT IS_INF(edge_amount)
    AND NOT IS_NAN(edge_amount)
    AND (edge_asset_type = 'native' OR (edge_asset_code IS NOT NULL AND edge_asset_issuer IS NOT NULL))
),
aggregated AS (
  SELECT
    from_account,
    to_account,
    edge_asset_type AS asset_type,
    edge_asset_code AS asset_code,
    edge_asset_issuer AS asset_issuer,
    SUM(edge_amount) AS total_amount,
    COUNT(*) AS op_count
  FROM filtered
  GROUP BY from_account, to_account, edge_asset_type, edge_asset_code, edge_asset_issuer
)
SELECT
  from_account,
  to_account,
  asset_type,
  asset_code,
  asset_issuer,
  CAST(total_amount AS STRING) AS amount,
  op_count
FROM aggregated
ORDER BY op_count DESC, total_amount DESC, from_account ASC, to_account ASC, asset_code ASC, asset_issuer ASC
LIMIT ${TOP_PAYMENT_FLOW_EDGES}
`;

/** @type {{ name: string, sql: string, requiredParams: string[] }[]} */
export const queryRegistry = [
  {
    name: "assetPaymentVolumeQuery",
    sql: assetPaymentVolumeQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "categoryQuery",
    sql: categoryQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "transactionCategoryQuery",
    sql: transactionCategoryQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "contractQuery",
    sql: contractQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "activeContractCountQuery",
    sql: activeContractCountQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "accountQuery",
    sql: accountQuery,
    requiredParams: ["start", "end", "types"],
  },
  {
    name: "sorobanFunctionQuery",
    sql: sorobanFunctionQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "sorobanFunctionContractQuery",
    sql: sorobanFunctionContractQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "nativePaymentVolumeQuery",
    sql: nativePaymentVolumeQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "usdcPaymentVolumeQuery",
    sql: usdcPaymentVolumeQuery,
    requiredParams: ["start", "end", "assets"],
  },
  {
    name: "activeDestinationCountQuery",
    sql: activeDestinationCountQuery,
    requiredParams: ["start", "end", "types"],
  },
  {
    name: "latestDataTimestampQuery",
    sql: latestDataTimestampQuery,
    requiredParams: [],
  },
  {
    name: "accountMetadataQuery",
    sql: accountMetadataQuery,
    requiredParams: ["ids"],
  },
  {
    name: "activeSourceAccountsQuery",
    sql: activeSourceAccountsQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "usdcCategoryQuery",
    sql: usdcCategoryQuery,
    requiredParams: ["start", "end", "assets"],
  },
  {
    name: "usdcAccountQuery",
    sql: usdcAccountQuery,
    requiredParams: ["start", "end", "assets"],
  },
  {
    name: "paymentFlowEdgesQuery",
    sql: paymentFlowEdgesQuery,
    requiredParams: ["start", "end"],
  },
  { name: "heatmapQuery", sql: heatmapQuery, requiredParams: ["start", "end"] },
  {
    name: "flowEdgeQuery",
    sql: flowEdgeQuery,
    requiredParams: ["start", "end", "assetMode"],
  },
];
