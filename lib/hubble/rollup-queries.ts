import { resolveRollupsDataset } from "./rollups-config";

/**
 * Rollup query for category operation count and XLM volume.
 * Reads from `daily_ops_summary` materialized view partitioned by bucket_date.
 */
export function rollupCategoryQuery(dataset = resolveRollupsDataset()): string {
  return `
SELECT
  type_string,
  SUM(op_count) AS op_count,
  SUM(xlm_volume) AS xlm_volume
FROM \`${dataset}.daily_ops_summary\`
WHERE bucket_date BETWEEN DATE(@start) AND DATE(@end)
  AND @start <= bucket_start AND bucket_start < @end
GROUP BY type_string
ORDER BY op_count DESC
`;
}

/**
 * Rollup query for transaction count per category.
 * Reads from `daily_ops_summary` materialized view partitioned by bucket_date.
 */
export function rollupTransactionCategoryQuery(dataset = resolveRollupsDataset()): string {
  return `
SELECT
  type_string,
  SUM(txn_count) AS txn_count
FROM \`${dataset}.daily_ops_summary\`
WHERE bucket_date BETWEEN DATE(@start) AND DATE(@end)
  AND @start <= bucket_start AND bucket_start < @end
GROUP BY type_string
ORDER BY txn_count DESC
`;
}

/**
 * Rollup query for daily timeseries buckets.
 * Reads from `daily_ops_summary` materialized view partitioned by bucket_date.
 */
export function rollupDailyTimeseriesQuery(dataset = resolveRollupsDataset()): string {
  return `
SELECT
  bucket_start AS bucket_time,
  SUM(tx_count) AS tx_count,
  SUM(op_count) AS op_count,
  SUM(soroban_op_count) AS soroban_op_count
FROM \`${dataset}.daily_ops_summary\`
WHERE bucket_date BETWEEN DATE(@start) AND DATE(@end)
  AND bucket_start BETWEEN @start AND @end
GROUP BY bucket_time
ORDER BY bucket_time ASC
`;
}

/**
 * Rollup query for daily distinct active source accounts.
 * Reads from `daily_active_wallets` table partitioned by bucket_date.
 * Note: When querying multiple days, MAX(active_accounts) or SUM(active_accounts) can provide
 * an estimate, or for a single day matches active_accounts directly.
 */
export function rollupActiveSourceAccountsQuery(dataset = resolveRollupsDataset()): string {
  return `
SELECT
  COALESCE(MAX(active_accounts), 0) AS active_accounts
FROM \`${dataset}.daily_active_wallets\`
WHERE bucket_date BETWEEN DATE(@start) AND DATE(@end)
  AND @start <= bucket_start AND bucket_start < @end
`;
}

/**
 * Rollup query for category share time series.
 * Reads from `category_share_hourly` or `category_share_daily`.
 */
export function rollupCategoryShareQuery(
  granularity: "hour" | "day",
  dataset = resolveRollupsDataset(),
): string {
  const table = granularity === "hour" ? "category_share_hourly" : "category_share_daily";
  return `
SELECT
  bucket_start,
  type_string,
  SUM(op_count) AS op_count
FROM \`${dataset}.${table}\`
WHERE bucket_start BETWEEN @start AND @end
GROUP BY bucket_start, type_string
ORDER BY bucket_start, type_string
`;
}
