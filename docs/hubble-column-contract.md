# Hubble column contract

LumenMap reads a small, fixed set of BigQuery columns. Nothing in the app
validates that those columns still exist, so a column silently disappearing
upstream surfaces as a runtime `INTERNAL_ERROR` on the dashboard rather than as
a build or test failure. The production outage that motivated this document was
exactly that: `details` was removed from the source table and
`activeDestinationCountQuery` started failing at query time.

This page is the contract. **Every column listed here must exist with the
documented type before the queries that use it can run.** If you change SQL,
walk the checklist at the bottom of this page first.

Canonical source of truth for the SQL itself:
[`lib/hubble/shared-queries.mjs`](../lib/hubble/shared-queries.mjs). All 17
queries registered in `queryRegistry` are listed below.

---

## Tables in scope

| Table | Role | Time column |
| --- | --- | --- |
| `crypto-stellar.crypto_stellar_dbt.enriched_history_operations` | Classic Stellar operations (payments, offers, account ops) | `closed_at` |
| `crypto-stellar.crypto_stellar_dbt.enriched_history_operations_soroban` | Soroban / smart-contract invocations | `closed_at` |
| `crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract` | Hourly per-contract fee aggregate | `hour_agg` (**not** `closed_at`) |
| `crypto-stellar.crypto_stellar_dbt.accounts_current` | Account metadata snapshot | none (current state) |

---

## `enriched_history_operations`

| Column | Type used as | Read by | Notes |
| --- | --- | --- | --- |
| `closed_at` | TIMESTAMP | every query below | Half-open predicate `@start <= closed_at AND closed_at < @end`. Also drives `isPeriodComplete` freshness. |
| `type_string` | STRING | `categoryQuery`, `transactionCategoryQuery`, `accountQuery`, `nativePaymentVolumeQuery`, `assetPaymentVolumeQuery`, `usdcPaymentVolumeQuery`, `activeDestinationCountQuery`, `usdcCategoryQuery`, `usdcAccountQuery` | Filtered against `ACCOUNT_QUERY_TYPES` / `DESTINATION_QUERY_TYPES`. |
| `amount` | FLOAT64 / NUMERIC | `categoryQuery`, `accountQuery`, `nativePaymentVolumeQuery`, `assetPaymentVolumeQuery`, `usdcPaymentVolumeQuery`, `usdcCategoryQuery`, `usdcAccountQuery` | Cast differently per query (`FLOAT64` for XLM volume, `NUMERIC` for USDC, `STRING` for the asset rollup). Negative / `NULL` / `INF` / `NAN` values are coerced to `0`. |
| `asset_type` | STRING | `categoryQuery`, `accountQuery`, `nativePaymentVolumeQuery`, `assetPaymentVolumeQuery` | `'native'` is the XLM sentinel. |
| `asset_code`, `asset_issuer` | STRING | `assetPaymentVolumeQuery`, `usdcPaymentVolumeQuery`, `usdcCategoryQuery`, `usdcAccountQuery` | Asset identity. USDC queries match the pair as `STRUCT(code, issuer) IN UNNEST(@assets)`. |
| `source_asset_type`, `source_asset_code`, `source_asset_issuer`, `source_amount` | STRING / FLOAT64 | `nativePaymentVolumeQuery`, `assetPaymentVolumeQuery`, `usdcPaymentVolumeQuery`, `usdcCategoryQuery`, `usdcAccountQuery` | Send-side of `path_payment_strict_send`. |
| `dest_asset_code`, `dest_asset_issuer`, `dest_amount` | STRING / FLOAT64 | `usdcCategoryQuery`, `usdcAccountQuery` | Destination-side of `path_payment_strict_receive`. |
| `op_source_account` | STRING | `accountQuery`, `activeSourceAccountsQuery`, `usdcAccountQuery` | Ranked per `type_string`. Rows starting with `M` (muxed) are excluded from the active-account count. |
| `transaction_hash` | STRING | `transactionCategoryQuery` | `COUNT(DISTINCT …)` for the transaction-count metric. |
| `transaction_id` | STRING | `heatmapQuery` | ⚠️ **Distinct from `transaction_hash` above.** See drift hazards. |
| `details.to`, `details.new_account`, `details.into` | nested STRUCT fields | `activeDestinationCountQuery` | ⚠️ **The outage vector.** See drift hazards. |

## `enriched_history_operations_soroban`

| Column | Type used as | Read by | Notes |
| --- | --- | --- | --- |
| `closed_at` | TIMESTAMP | `sorobanFunctionQuery`, `sorobanFunctionContractQuery` | Same half-open convention. |
| `soroban_operation_type` | STRING | `sorobanFunctionQuery`, `sorobanFunctionContractQuery` | `'invoke_contract'` gates the function-name decode. |
| `parameters_decoded` | ARRAY\<STRUCT\> | `sorobanFunctionQuery`, `sorobanFunctionContractQuery` | Indexed with `SAFE_OFFSET(1)`; `.type = 'Sym'` and `.value` become the function name. Nested/offset-sensitive. |
| `contract_id` | STRING | `sorobanFunctionContractQuery` | Null/empty filtered. |

## `hourly_soroban_fee_agg_contract`

| Column | Type used as | Read by | Notes |
| --- | --- | --- | --- |
| `hour_agg` | TIMESTAMP | `contractQuery`, `activeContractCountQuery` | ⚠️ Time column is `hour_agg`, not `closed_at`. |
| `contract_id` | STRING | `contractQuery`, `activeContractCountQuery` | Null/empty filtered identically in both, so the leaderboard and the uncapped count stay consistent. |
| `txn_count` | INTEGER | `contractQuery` | Summed into `op_count`. Pre-aggregated, so it is an operation count per hour-bucket. |

## `accounts_current`

| Column | Type used as | Read by | Notes |
| --- | --- | --- | --- |
| `account_id` | STRING | `accountMetadataQuery` | Matched with `IN UNNEST(@ids)`. |
| `home_domain` | STRING | `accountMetadataQuery` | Null/empty filtered; drives entity label resolution. |

---

## Query → column matrix

Every entry of `queryRegistry` with the columns it would fail on if removed.

| Query | Table | Columns | Params |
| --- | --- | --- | --- |
| `categoryQuery` | `enriched_history_operations` | `type_string`, `asset_type`, `amount`, `closed_at` | `start`, `end` |
| `transactionCategoryQuery` | `enriched_history_operations` | `type_string`, `transaction_hash`, `closed_at` | `start`, `end` |
| `contractQuery` | `hourly_soroban_fee_agg_contract` | `contract_id`, `txn_count`, `hour_agg` | `start`, `end` |
| `activeContractCountQuery` | `hourly_soroban_fee_agg_contract` | `contract_id`, `hour_agg` | `start`, `end` |
| `accountQuery` | `enriched_history_operations` | `op_source_account`, `type_string`, `asset_type`, `amount`, `closed_at` | `start`, `end`, `types` |
| `sorobanFunctionQuery` | `enriched_history_operations_soroban` | `soroban_operation_type`, `parameters_decoded`, `closed_at` | `start`, `end` |
| `sorobanFunctionContractQuery` | `enriched_history_operations_soroban` | `parameters_decoded`, `contract_id`, `soroban_operation_type`, `closed_at` | `start`, `end` |
| `nativePaymentVolumeQuery` | `enriched_history_operations` | `type_string`, `asset_type`, `amount`, `source_asset_type`, `source_amount`, `closed_at` | `start`, `end` |
| `assetPaymentVolumeQuery` | `enriched_history_operations` | `type_string`, `asset_type`, `asset_code`, `asset_issuer`, `amount`, `source_*` (4), `closed_at` | `start`, `end` |
| `usdcPaymentVolumeQuery` | `enriched_history_operations` | `type_string`, `asset_code`, `asset_issuer`, `amount`, `source_asset_code`, `source_asset_issuer`, `source_amount`, `closed_at` | `start`, `end`, `assets` |
| `activeDestinationCountQuery` | `enriched_history_operations` | `type_string`, `closed_at`, `details.to`, `details.new_account`, `details.into` | `start`, `end`, `types` |
| `latestDataTimestampQuery` | `enriched_history_operations` | `closed_at` | — |
| `accountMetadataQuery` | `accounts_current` | `account_id`, `home_domain` | `ids` |
| `activeSourceAccountsQuery` | `enriched_history_operations` | `op_source_account`, `closed_at` | `start`, `end` |
| `usdcCategoryQuery` | `enriched_history_operations` | `type_string`, `asset_code`, `asset_issuer`, `amount`, `dest_*` (3), `source_*` (3), `closed_at` | `start`, `end`, `assets` |
| `usdcAccountQuery` | `enriched_history_operations` | `op_source_account`, `type_string`, `asset_*`, `amount`, `dest_*` (3), `source_*` (3), `closed_at` | `start`, `end`, `assets` |
| `heatmapQuery` | `enriched_history_operations` | `closed_at`, `transaction_id` | `start`, `end` |

`queryRegistry` is asserted to stay in sync with the exported constants by
`npm run test:hubble:registry`, so a newly added query that is not registered
fails that check. This document is the human-readable counterpart — **if you add
a query, add a row here too.**

---

## Known drift hazards

These have bitten (or are one rename away from biting) the project:

1. **`details.*` nested struct** — `activeDestinationCountQuery` reads
   `details.to`, `details.new_account` and `details.into`. Removing or renaming
   any field of that struct breaks the query at execution time and, because the
   KPI is fetched alongside everything else, took the whole activity response
   down. Treat any change here as breaking and confirm the soft-fail path
   (see issue #299) before shipping.
2. **Two transaction identifiers** — `transaction_hash` (used by
   `transactionCategoryQuery`) and `transaction_id` (used by `heatmapQuery`)
   are different columns. Do not "unify" them without checking which one is
   actually populated in the current table.
3. **`hour_agg` vs `closed_at`** — the Soroban fee aggregate table is hourly and
   uses `hour_agg`. Copying a `closed_at` predicate onto it fails.
4. **`parameters_decoded[SAFE_OFFSET(1)]`** — offset-sensitive. A schema change
   that reorders the parameter array silently changes which value is treated as
   the function name; there is no error, just wrong labels.
5. **Numeric casts** — XLM volume reads `amount` as `FLOAT64`, USDC reads it as
   `NUMERIC`, and the asset rollup emits `amount` as `STRING`. Changing a cast
   changes reported totals without any error.

---

## Verifying columns before you ship SQL

Run these against the real dataset (requires GCP credentials — see
[CONTRIBUTING.md](../CONTRIBUTING.md#query-changes-requires-gcp)). They are
read-only and cost nothing beyond the free `INFORMATION_SCHEMA` tier.

List every column currently present in a table:

```sql
SELECT column_name, data_type, is_nullable
FROM `crypto-stellar.crypto_stellar_dbt.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'enriched_history_operations'
ORDER BY ordinal_position;
```

Check just the columns a single query needs (paste the list from the matrix
above):

```sql
SELECT column_name
FROM `crypto-stellar.crypto_stellar_dbt.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'enriched_history_operations'
  AND column_name IN (
    'type_string', 'closed_at', 'details', 'amount', 'asset_type'
  );
-- Expect one row per name. A missing row means the column is gone.
```

Inspect a nested struct such as `details`:

```sql
SELECT column_name, data_type
FROM `crypto-stellar.crypto_stellar_dbt.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'enriched_history_operations'
  AND column_name LIKE 'details.%';
```

Dry-run a query without paying for it (BigQuery validates column references in
the dry-run, so a missing column fails here rather than in production):

```bash
bq query --dry_run --use_legacy_sql=false \
  --parameter='start::2026-09-01T00:00:00Z' \
  --parameter='end::2026-09-02T00:00:00Z' \
  --parameter='types:ARRAY<STRING>:["payment","path_payment_strict_receive","path_payment_strict_send","create_account","account_merge"]' \
  "$(node -e "import('./lib/hubble/shared-queries.mjs').then(m=>console.log(m.activeDestinationCountQuery))")"
```

If you have no GCP access, say so explicitly in the PR and ask a maintainer to
run the dry-run — do not assume the SQL is valid because TypeScript compiled.

---

## PR checklist for SQL changes

Copy this block into the PR description whenever you touch
`lib/hubble/shared-queries.mjs`, `lib/hubble/queries.ts` or
`lib/hubble/activity.ts`:

```markdown
- [ ] Every column I reference is listed in `docs/hubble-column-contract.md`, or I added it there in this PR
- [ ] I ran the INFORMATION_SCHEMA check for the columns I use (paste output, or note "no GCP access")
- [ ] I dry-ran each changed query, or asked a maintainer to dry-run it
- [ ] New/changed query is registered in `queryRegistry` and `npm run test:hubble:registry` passes
- [ ] If the response shape changed, `lib/hubble/fixture.ts` was updated to match
- [ ] If response semantics changed, the cache key prefix in `lib/hubble/activity.ts` was bumped
- [ ] If the query is optional/non-critical, it fails soft instead of 500-ing the whole activity response
```

## When this document goes stale

- A column is added or removed upstream → update the tables above in the same PR
  as the SQL change.
- A query is added → add a row to the query matrix; `npm run test:hubble:registry`
  will remind you if you forget the registry half.
- Automated schema-diff CI against live BigQuery is deliberately out of scope
  here; until it exists, this page plus the checklist above is the guard rail.
