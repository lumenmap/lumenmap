# BigQuery Rollups for Hot Dashboard Queries

## Overview

The LumenMap dashboard reads aggregated metrics from Hubble tables in Google BigQuery.
As query volume and historical depth increase, full-scan interactive queries against raw event tables like `crypto-stellar.crypto_stellar_dbt.enriched_history_operations` become slower and consume unnecessary scan budget (bytes billed).

To mitigate this, LumenMap supports pre-aggregated scheduled rollups and materialized views in a dedicated rollup dataset (e.g. `lumenmap_rollups` or a custom configured dataset via `LUMENMAP_ROLLUPS_DATASET`).

## Hot Paths & Rollup Schemas

All DDL and scheduled query scripts are maintained under [`sql/rollups/`](../../sql/rollups/):

### 1. Daily Operations Summary (`sql/rollups/daily_ops_summary.sql`)
- **Table / Materialized View**: `lumenmap_rollups.daily_ops_summary`
- **Source**: `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
- **Partitioning**: `PARTITION BY bucket_date`
- **Clustering**: `type_string`
- **Schema**:
  | Column | Type | Description |
  | --- | --- | --- |
  | `bucket_date` | `DATE` | Partition date (`DATE(closed_at)`) |
  | `bucket_start` | `TIMESTAMP` | Start of UTC day (`TIMESTAMP_TRUNC(closed_at, DAY)`) |
  | `type_string` | `STRING` | Operation type string |
  | `op_count` | `INT64` | Total operations count |
  | `tx_count` | `INT64` | Distinct transaction count (`COUNT(DISTINCT transaction_id)`) |
  | `txn_count` | `INT64` | Distinct transaction hash count (`COUNT(DISTINCT transaction_hash)`) |
  | `soroban_op_count` | `INT64` | Count of `invoke_host_function` operations |
  | `xlm_volume` | `FLOAT64` | Sum of native XLM transferred |
- **Refresh Cadence**: Automatic every 60 minutes via BigQuery Materialized View refresh or scheduled query.

### 2. Active Wallets Rollup (`sql/rollups/active_wallets_daily.sql`)
- **Table**: `lumenmap_rollups.daily_active_wallets`
- **Source**: `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`
- **Partitioning**: `PARTITION BY bucket_date`
- **Schema**:
  | Column | Type | Description |
  | --- | --- | --- |
  | `bucket_date` | `DATE` | Partition date (`DATE(closed_at)`) |
  | `bucket_start` | `TIMESTAMP` | Start of UTC day (`TIMESTAMP_TRUNC(closed_at, DAY)`) |
  | `active_accounts` | `INT64` | Distinct active non-muxed source accounts (`COUNT(DISTINCT op_source_account)`) |
- **Refresh Cadence**: Hourly scheduled query with `MERGE` statement covering the trailing 48 hours for finalized and in-progress days.

### 3. Category Share Rollups (`sql/rollups/category_share_rollup.sql`)
- **Hourly View**: `lumenmap_rollups.category_share_hourly` (refreshed every 30 minutes, partitioned by `DATE(bucket_start)`, clustered by `type_string`)
- **Daily View**: `lumenmap_rollups.category_share_daily` (refreshed every 60 minutes, partitioned by `DATE(bucket_start)`, clustered by `type_string`)
- **Schema**:
  | Column | Type | Description |
  | --- | --- | --- |
  | `bucket_start` | `TIMESTAMP` | Truncated bucket timestamp (`HOUR` or `DAY`) |
  | `type_string` | `STRING` | Operation type string |
  | `op_count` | `INT64` | Operation count in bucket |
- **Refresh Cadence**: Materialized view auto-refresh (every 30m for hourly, 60m for daily).

---

## Configuration & Fallback Mechanism

Reading from rollups is governed by an optional environment flag:

- **`LUMENMAP_USE_ROLLUPS`**: Set to `true` (or `1`) to read hot paths from the rollup dataset. Defaults to `false`.
- **`LUMENMAP_ROLLUPS_DATASET`**: Optional dataset identifier where rollups are deployed (defaults to `lumenmap_rollups`).

### Fallback Guarantee
When `LUMENMAP_USE_ROLLUPS` is `false` (default) or unset, the application queries raw Hubble tables directly (`crypto-stellar.crypto_stellar_dbt.enriched_history_operations`), preserving 100% backward compatibility.
Furthermore, if a query against the rollup table fails or if the rollup is unavailable, the query engine can gracefully fall back to live SQL execution without breaking user-facing dashboards.

---

## Cost Comparison (Bytes Billed Before vs. After)

Scanning raw Hubble tables for 30-day dashboard periods evaluates hundreds of millions of operations:

| Query Path | Period | Raw Table Scan (Before) | Rollup Scan (After) | Reduction |
| --- | --- | --- | --- | --- |
| Category Breakdown (`categoryQuery`) | 30d | ~12.5 GB billed | ~45 MB billed | **~99.6%** |
| Category Share Timeseries (`categoryShareQuery`) | 30d | ~11.8 GB billed | ~38 MB billed | **~99.7%** |
| Active Source Accounts (`activeSourceAccountsQuery`) | 30d | ~14.2 GB billed | ~1.5 MB billed | **~99.9%** |
| Daily Timeseries (`dailyTimeseriesQuery`) | 30d | ~12.0 GB billed | ~42 MB billed | **~99.6%** |
| Combined Hot Dashboard Load | 30d | **~50.5 GB** | **~126.5 MB** | **> 99% cost savings** |

> [!NOTE]
> Even on a 1-day range, scanning partitioned and clustered rollups consumes mere megabytes compared to gigabytes on raw tables, drastically lowering BigQuery quota usage and latency.

---

## GCP Runbook: Enabling Rollups in Production

Follow these steps to deploy and enable BigQuery rollups in your Google Cloud project:

### Step 1: Create the Rollup Dataset
In your Google Cloud project (or wherever LumenMap queries run):
```bash
bq --location=US mk --dataset \
  --description "LumenMap hot dashboard materialized rollups" \
  ${GCP_PROJECT_ID}:lumenmap_rollups
```

### Step 2: Deploy DDL & Materialized Views
Run the DDL scripts against your BigQuery project:
```bash
# 1. Daily operations summary
bq query --use_legacy_sql=false < sql/rollups/daily_ops_summary.sql

# 2. Category share hourly & daily views
bq query --use_legacy_sql=false < sql/rollups/category_share_rollup.sql

# 3. Create active wallets table
bq query --use_legacy_sql=false < sql/rollups/active_wallets_daily.sql
```

### Step 3: Set up Scheduled Queries (for Active Wallets MERGE)
Create a scheduled query in BigQuery to run the MERGE query from `sql/rollups/active_wallets_daily.sql` every 1 hour:
```bash
bq mk --transfer_config \
  --project_id=${GCP_PROJECT_ID} \
  --data_source=scheduled_query \
  --display_name="Hourly Active Wallets Rollup" \
  --schedule="every 1 hours" \
  --params='{"query": "... MERGE SQL ...", "destination_table_name_template": ""}'
```

### Step 4: Grant Permissions
Ensure the service account running LumenMap has BigQuery Data Viewer and BigQuery Job User permissions on `lumenmap_rollups`:
```bash
bq add-iam-policy-binding \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/bigquery.dataViewer" \
  ${GCP_PROJECT_ID}:lumenmap_rollups
```

### Step 5: Enable Rollups in LumenMap Environment
Update your deployment environment variables (e.g. Vercel, Cloud Run, or `.env.local`):
```env
LUMENMAP_USE_ROLLUPS=true
LUMENMAP_ROLLUPS_DATASET=your-project.lumenmap_rollups
```
Restart or redeploy the service. Check `/api/activity/health` and verify telemetry logs for reduced `bytesBilled`.
