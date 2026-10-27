-- Materialized Rollup: Category Share Hourly & Daily
-- Source: `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
-- Destination: `lumenmap_rollups.category_share_hourly` and `lumenmap_rollups.category_share_daily`
-- Partitioning: PARTITION BY DATE(bucket_start)
-- Cluster: type_string
-- Refresh cadence: Materialized view auto-refresh (30-60 min) or scheduled table refresh

-- 1. Hourly Rollup (used for 1d granularity)
CREATE MATERIALIZED VIEW IF NOT EXISTS `lumenmap_rollups.category_share_hourly`
PARTITION BY DATE(bucket_start)
CLUSTER BY type_string
OPTIONS (
  enable_refresh = true,
  refresh_interval_minutes = 30
) AS
SELECT
  TIMESTAMP_TRUNC(closed_at, HOUR) AS bucket_start,
  type_string,
  COUNT(*) AS op_count
FROM `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
GROUP BY bucket_start, type_string;

-- 2. Daily Rollup (used for 7d, 30d, month granularities)
CREATE MATERIALIZED VIEW IF NOT EXISTS `lumenmap_rollups.category_share_daily`
PARTITION BY DATE(bucket_start)
CLUSTER BY type_string
OPTIONS (
  enable_refresh = true,
  refresh_interval_minutes = 60
) AS
SELECT
  TIMESTAMP_TRUNC(closed_at, DAY) AS bucket_start,
  type_string,
  COUNT(*) AS op_count
FROM `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
GROUP BY bucket_start, type_string;
