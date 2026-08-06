#!/usr/bin/env node

import pkg from "@next/env";
import { BigQuery } from "@google-cloud/bigquery";

const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const keyBase64 = process.env.GCP_SERVICE_ACCOUNT_KEY;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!keyBase64 && !credPath) {
  console.error(
    "No GCP credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or GCP_SERVICE_ACCOUNT_KEY in .env.local; see .env.example for setup.",
  );
  process.exit(1);
}

const TOP_ACCOUNTS_PER_TYPE = 70;
const TOP_CONTRACT_LIMIT = 200;
const TOP_CONTRACTS_PER_FUNCTION = 70;
const TOP_SOROBAN_FUNCTIONS = 100;
const DESTINATION_QUERY_TYPES = [
  "payment",
  "path_payment_strict_receive",
  "path_payment_strict_send",
  "create_account",
  "account_merge",
];

const ACCOUNT_QUERY_TYPES = [
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

const categoryQuery = `
SELECT type_string, COUNT(*) AS op_count,
SUM(CASE WHEN asset_type = 'native' THEN CAST(amount AS FLOAT64) ELSE 0 END) AS xlm_volume
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
GROUP BY type_string
ORDER BY op_count DESC`;

const nativePaymentVolumeQuery = `
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
WHERE closed_at BETWEEN @start AND @end`;

const contractQuery = `
SELECT contract_id, SUM(txn_count) AS op_count
FROM \`crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract\`
WHERE hour_agg BETWEEN @start AND @end
  AND contract_id IS NOT NULL AND contract_id != ''
GROUP BY contract_id
ORDER BY op_count DESC
LIMIT ${TOP_CONTRACT_LIMIT}`;

const activeContractCountQuery = `
SELECT DISTINCT contract_id
FROM \`crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract\`
WHERE hour_agg BETWEEN @start AND @end
  AND contract_id IS NOT NULL AND contract_id != ''`;

const accountQuery = `
WITH ranked AS (
  SELECT
    op_source_account AS account_id,
    type_string,
    COUNT(*) AS op_count,
    SUM(CASE WHEN asset_type = 'native' THEN CAST(amount AS FLOAT64) ELSE 0 END) AS xlm_volume,
    ROW_NUMBER() OVER (PARTITION BY type_string ORDER BY COUNT(*) DESC) AS rank
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string IN UNNEST(@types)
  GROUP BY account_id, type_string
)
SELECT account_id, type_string, op_count, xlm_volume FROM ranked
WHERE rank <= ${TOP_ACCOUNTS_PER_TYPE}
ORDER BY type_string, op_count DESC`;

const sorobanFunctionQuery = `
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
SELECT function_name, COUNT(*) AS op_count
FROM labeled
WHERE function_name IS NOT NULL AND function_name != ''
GROUP BY function_name
ORDER BY op_count DESC
LIMIT ${TOP_SOROBAN_FUNCTIONS}`;

const sorobanFunctionContractQuery = `
WITH aggregated AS (
  SELECT
    parameters_decoded[SAFE_OFFSET(1)].value AS function_name,
    contract_id,
    COUNT(*) AS op_count
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations_soroban\`
  WHERE closed_at BETWEEN @start AND @end
    AND soroban_operation_type = 'invoke_contract'
    AND parameters_decoded[SAFE_OFFSET(1)].type = 'Sym'
    AND contract_id IS NOT NULL AND contract_id != ''
  GROUP BY function_name, contract_id
),
ranked AS (
  SELECT
    function_name,
    contract_id,
    op_count,
    ROW_NUMBER() OVER (PARTITION BY function_name ORDER BY op_count DESC) AS rank
  FROM aggregated
)
SELECT function_name, contract_id, op_count
FROM ranked
WHERE rank <= ${TOP_CONTRACTS_PER_FUNCTION}
ORDER BY function_name, op_count DESC`;

const usdcPaymentVolumeQuery = `
WITH supported_assets AS (
  SELECT code, issuer
  FROM UNNEST(@assets)
),
qualifying_payments AS (
  SELECT asset_code AS code, asset_issuer AS issuer, CAST(amount AS NUMERIC) AS amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string = 'payment'
    AND asset_code IS NOT NULL AND asset_issuer IS NOT NULL

  UNION ALL

  SELECT asset_code AS code, asset_issuer AS issuer, CAST(amount AS NUMERIC) AS amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string = 'path_payment_strict_receive'
    AND asset_code IS NOT NULL AND asset_issuer IS NOT NULL

  UNION ALL

  SELECT source_asset_code AS code, source_asset_issuer AS issuer, CAST(source_amount AS NUMERIC) AS amount
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string = 'path_payment_strict_send'
    AND source_asset_code IS NOT NULL AND source_asset_issuer IS NOT NULL
)
SELECT supported_assets.code, supported_assets.issuer, COALESCE(SUM(qualifying_payments.amount), 0) AS amount
FROM supported_assets
LEFT JOIN qualifying_payments
  ON qualifying_payments.code = supported_assets.code
  AND qualifying_payments.issuer = supported_assets.issuer
GROUP BY supported_assets.code, supported_assets.issuer
ORDER BY amount DESC`;

const activeSourceAccountsQuery = `
SELECT
  COUNT(DISTINCT op_source_account) AS active_accounts
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
  AND op_source_account IS NOT NULL
  AND op_source_account != ''
  AND op_source_account NOT LIKE 'M%'
`;

const end = new Date().toISOString();
const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const baseParams = { start, end };

let client;
if (keyBase64) {
  const credentials = JSON.parse(
    Buffer.from(keyBase64, "base64").toString("utf-8"),
  );
  client = new BigQuery({
    projectId: credentials.project_id,
    credentials,
  });
} else {
  client = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID ?? "stellar-501912",
  });
}

const queries = [
  { name: "categoryQuery", sql: categoryQuery, params: baseParams },
  { name: "contractQuery", sql: contractQuery, params: baseParams },
  {
    name: "activeContractCountQuery",
    sql: activeContractCountQuery,
    params: baseParams,
  },
  {
    name: "accountQuery",
    sql: accountQuery,
    params: { ...baseParams, types: ACCOUNT_QUERY_TYPES },
  },
  { name: "sorobanFunctionQuery", sql: sorobanFunctionQuery, params: baseParams },
  {
    name: "sorobanFunctionContractQuery",
    sql: sorobanFunctionContractQuery,
    params: baseParams,
  },
  {
    name: "activeSourceAccountsQuery",
    sql: activeSourceAccountsQuery,
    params: baseParams,
  },
  {
    name: "nativePaymentVolumeQuery",
    sql: nativePaymentVolumeQuery,
    params: baseParams,
  },
];

let failed = false;
const rowCounts = {};

for (const query of queries) {
  process.stdout.write(`Testing ${query.name}... `);
  try {
    const [rows] = await client.query({ query: query.sql, params: query.params });
    rowCounts[query.name] = rows.length;
    console.log(`ok (${rows.length} rows)`);
  } catch (error) {
    failed = true;
    console.log("FAILED");
    console.error(error instanceof Error ? error.message : error);
  }
}

if (
  !failed &&
  rowCounts.activeContractCountQuery !== undefined &&
  rowCounts.contractQuery !== undefined
) {
  process.stdout.write(
    "Verifying activeContractCountQuery is uncapped relative to contractQuery... ",
  );
  if (rowCounts.activeContractCountQuery < rowCounts.contractQuery) {
    failed = true;
    console.log("FAILED");
    console.error(
      `activeContractCountQuery returned ${rowCounts.activeContractCountQuery} distinct contracts, ` +
        `fewer than the ${rowCounts.contractQuery}-row capped leaderboard (limit ${TOP_CONTRACT_LIMIT}).`,
    );
  } else {
    console.log(
      `ok (${rowCounts.activeContractCountQuery} distinct contracts, independent of TOP_CONTRACT_LIMIT=${TOP_CONTRACT_LIMIT})`,
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log("All Hubble queries passed.");
