-- Materialized Rollup: Daily Operations Summary (Daily Ops)
-- Source: `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
-- Destination: `lumenmap_rollups.daily_ops_summary`
-- Partitioning: PARTITION BY bucket_date
-- Cluster: type_string
-- Refresh cadence: Hourly or via scheduled query / dbt model

CREATE MATERIALIZED VIEW IF NOT EXISTS `lumenmap_rollups.daily_ops_summary`
PARTITION BY bucket_date
CLUSTER BY type_string
OPTIONS (
  enable_refresh = true,
  refresh_interval_minutes = 60
) AS
SELECT
  DATE(closed_at) AS bucket_date,
  TIMESTAMP_TRUNC(closed_at, DAY) AS bucket_start,
  type_string,
  COUNT(*) AS op_count,
  COUNT(DISTINCT transaction_id) AS tx_count,
  COUNT(DISTINCT transaction_hash) AS txn_count,
  COUNTIF(type_string = 'invoke_host_function') AS soroban_op_count,
  SUM(CASE WHEN asset_type = 'native' THEN CAST(amount AS FLOAT64) ELSE 0 END) AS xlm_volume
FROM `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
GROUP BY bucket_date, bucket_start, type_string;
