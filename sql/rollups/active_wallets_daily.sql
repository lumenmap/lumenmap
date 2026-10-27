-- Materialized Rollup: Active Wallets Daily (Daily Active Wallets / Accounts)
-- Source: `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
-- Destination: `lumenmap_rollups.daily_active_wallets`
-- Refresh cadence: Scheduled query / table refresh every 60 minutes
-- Note: Muxed accounts (M%) and empty/null values are excluded per LumenMap active wallet methodology.

CREATE TABLE IF NOT EXISTS `lumenmap_rollups.daily_active_wallets` (
  bucket_date DATE,
  bucket_start TIMESTAMP,
  active_accounts INT64
)
PARTITION BY bucket_date
OPTIONS (
  description = "Daily distinct active source accounts rollup excluding muxed (M%) accounts"
);

-- Scheduled MERGE query (runs hourly for current and previous day):
MERGE `lumenmap_rollups.daily_active_wallets` T
USING (
  SELECT
    DATE(closed_at) AS bucket_date,
    TIMESTAMP_TRUNC(closed_at, DAY) AS bucket_start,
    COUNT(DISTINCT op_source_account) AS active_accounts
  FROM `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
  WHERE closed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY)
    AND op_source_account IS NOT NULL
    AND op_source_account != ''
    AND op_source_account NOT LIKE 'M%'
  GROUP BY bucket_date, bucket_start
) S
ON T.bucket_date = S.bucket_date
WHEN MATCHED THEN
  UPDATE SET active_accounts = S.active_accounts, bucket_start = S.bucket_start
WHEN NOT MATCHED THEN
  INSERT (bucket_date, bucket_start, active_accounts)
  VALUES (S.bucket_date, S.bucket_start, S.active_accounts);
