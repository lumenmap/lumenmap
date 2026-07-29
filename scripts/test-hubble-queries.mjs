#!/usr/bin/env node

import { BigQuery } from "@google-cloud/bigquery";

const TOP_ACCOUNTS_PER_TYPE = 70;
const TOP_CONTRACT_LIMIT = 200;
const TOP_CONTRACTS_PER_FUNCTION = 70;
const TOP_SOROBAN_FUNCTIONS = 100;
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
SELECT type_string, COUNT(*) AS op_count
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
GROUP BY type_string
ORDER BY op_count DESC`;

const contractQuery = `
SELECT contract_id, SUM(txn_count) AS op_count
FROM \`crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract\`
WHERE hour_agg BETWEEN @start AND @end
  AND contract_id IS NOT NULL AND contract_id != ''
GROUP BY contract_id
ORDER BY op_count DESC
LIMIT ${TOP_CONTRACT_LIMIT}`;

const accountQuery = `
WITH ranked AS (
  SELECT
    op_source_account AS account_id,
    type_string,
    COUNT(*) AS op_count,
    ROW_NUMBER() OVER (PARTITION BY type_string ORDER BY COUNT(*) DESC) AS rank
  FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
  WHERE closed_at BETWEEN @start AND @end
    AND type_string IN UNNEST(@types)
  GROUP BY account_id, type_string
)
SELECT account_id, type_string, op_count FROM ranked
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

const transactionCountQuery = `
SELECT COUNT(*) AS transaction_count
FROM \`crypto-stellar.crypto_stellar.history_transactions\`
WHERE closed_at BETWEEN @start AND @end
  AND successful = true`;

const end = new Date().toISOString();
const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const baseParams = { start, end };

const client = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID ?? "stellar-501912",
});

const queries = [
  { name: "categoryQuery", sql: categoryQuery, params: baseParams },
  { name: "contractQuery", sql: contractQuery, params: baseParams },
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
  { name: "transactionCountQuery", sql: transactionCountQuery, params: baseParams },
];

let failed = false;

for (const query of queries) {
  process.stdout.write(`Testing ${query.name}... `);
  try {
    const [rows] = await client.query({ query: query.sql, params: query.params });
    console.log(`ok (${rows.length} rows)`);
  } catch (error) {
    failed = true;
    console.log("FAILED");
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failed) {
  process.exit(1);
}

console.log("All Hubble queries passed.");
