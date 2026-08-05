# LumenMap metric methodology

**Methodology version:** 1.0.0  
**Status:** Canonical for the current mainnet dashboard and its planned metrics  
**Last updated:** 2026-07-28

This document is the authoritative definition of LumenMap metrics. A label in the
application, API, README, or a future chart must use the definition here. A metric
must not be inferred from a similarly named treemap value, query, or external
explorer statistic.

## Common conventions

- **Network and source.** Unless a metric explicitly says otherwise, data is from
  Stellar **mainnet** in Hubble BigQuery dataset
  `crypto-stellar.crypto_stellar_dbt`. The dashboard does not combine Hubble data
  with explorer data.
- **Time predicate.** Current activity queries use inclusive timestamp predicates:
  `field BETWEEN @start AND @end`. `@start` and `@end` are ISO-8601 timestamps
  produced by `lib/periods.ts`; they retain the application server's local offset
  when sent to BigQuery. A boundary record can therefore be included in both
  independently run adjacent ranges. LumenMap does not presently publish adjacent
  range totals as an additive time series.
- **Periods.** `1d` is local calendar today from `startOfDay(now)` through
  `endOfDay(now)`; `7d` starts at the local start of day six days before `now`;
  `30d` starts 29 days before; and `month` runs from the local start through local
  end of the current calendar month. These are calendar-based windows, **not** a
  rolling last 24/168/720 hours window. The response returns the exact `start` and
  `end` timestamps; those timestamps, rather than the display label, are the
  authoritative coverage.
- **Current-period status.** Today and this month are always in progress before
  their configured end. The 7- and 30-day windows also include the in-progress
  current day. Values are cumulative only through the latest data Hubble has
  ingested, not through the requested end timestamp. The API currently does not
  expose a completeness flag or a Hubble watermark, so consumers must treat every
  range containing the current day as **partial / provisional**.
- **Hubble freshness.** Hubble refreshes in intraday batches and is not a live
  ledger feed. Recently closed ledgers can be absent, late-arriving rows can change
  a previously returned value, and the five activity queries may reflect different
  ingestion points. Responses are additionally cached in process for 15 minutes by
  default (`CACHE_TTL_SECONDS`). Do not use LumenMap values for real-time monitoring,
  settlement, or an assertion that a period is final.
- **Counts and missing values.** A `COUNT(*)` count counts source rows, including a
  row whose optional descriptive fields are null. Identifier-based metrics exclude
  null or empty identifiers where stated. Labels from `entities.json`, Stellar
  Expert, or `home_domain` change display names only, never a metric identity.

## Metric definitions

### Operations

**Methodology ID:** `operations` · **Version:** `1.0.0`

| Property | Canonical definition |
| --- | --- |
| **Unit** | One Stellar operation record. |
| **Aggregation** | `COUNT(*)`, grouped by `type_string` where a breakdown is needed; **Total Operations** is the sum of those grouped counts. |
| **Time basis** | `closed_at BETWEEN @start AND @end`, using the common period convention. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`; fields `closed_at` and `type_string`. Implemented by `categoryQuery` in `lib/hubble/queries.ts`. |
| **Includes** | Every operation row returned by that table in the selected range, across all `type_string` values. Category totals map types using `TYPE_TO_GROUP`; unmapped types are **Other**. |
| **Excludes** | No operation type is deliberately excluded from Total Operations. A missing or delayed Hubble row is not counted. |
| **Limitations** | This is not a transaction count: one transaction can contain multiple operations. Category mapping is a presentation grouping and can change only with a methodology version change. Subject to the common partial-period, freshness, cache, and inclusive-boundary limitations. |

### Transactions

**Methodology ID:** `transactions` · **Version:** `1.0.0`

| Property | Canonical definition |
| --- | --- |
| **Unit** | One unique on-chain transaction, identified by its transaction hash. |
| **Aggregation** | `COUNT(DISTINCT transaction_hash)`; an operation-bearing transaction is counted once even if it contains several operations. |
| **Time basis** | The transaction's close time in the selected range. When derived from operation data, apply the `closed_at` predicate before deduplication. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`; `transaction_hash` and `closed_at`. |
| **Includes** | Unique transactions represented by the selected source rows in the range. |
| **Excludes** | Transactions absent from that operation dataset, including any transaction with no represented operation row. |
| **Limitations** | **Not currently returned by the dashboard or API.** It must not be substituted with Total Operations or any treemap value. It shares Hubble freshness and partial-period limitations. |

An operation count and a transaction count are deliberately different metrics. In
particular, summing operation-type counts must never be labelled “transactions.”

### Payment volume

**Methodology ID:** `payment-volume` · **Version:** `1.0.0`

| Property | Canonical definition |
| --- | --- |
| **Unit** | Amount in the payment asset's native units, reported separately for each asset identity. |
| **Aggregation** | `SUM(amount)` grouped by `(asset_code, asset_issuer)`; native XLM must be its own explicit asset bucket. No sum across asset buckets is a payment-volume metric. |
| **Time basis** | `closed_at BETWEEN @start AND @end`. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`; direct payment rows (`type_string = 'payment'`) and their `amount`, `asset_code`, `asset_issuer`, and `closed_at` fields. |
| **Includes** | Successful direct `payment` operation amounts represented in Hubble, attributed to the asset sent by the operation. |
| **Excludes** | Path-payment operations, `create_account` starting balances, DEX trades, liquidity-pool flows, fees, and any non-payment operation. They require separate definitions and are not payment volume. |
| **Limitations** | **Not currently returned by the dashboard or API.** Asset units have different meanings and decimals; displaying “total volume” across XLM, issued assets, or other assets is prohibited unless a separately documented versioned normalization specifies the price source, quote currency, timestamp, missing-price policy, and aggregation. Hubble freshness and partial-period limits apply. |

### Total value locked (TVL)

**Methodology ID:** `total-value-locked` · **Version:** `1.0.0`

| Property | Canonical definition |
| --- | --- |
| **Unit** | A fiat quote currency amount (for example, USD), plus the quote currency and snapshot timestamp. |
| **Aggregation** | Sum the priced balances in the approved protocol scope at one snapshot time. Aggregate only after deduplicating the underlying economic positions; do not sum both a pool share/LP token and the pool's underlying reserves. |
| **Time basis** | **Point in time**, never a daily or period sum. A TVL result must state its `asOf` timestamp and pricing timestamp. |
| **Source** | **No source dataset, balance field, pricing feed, or protocol adapter is currently selected.** TVL is therefore unavailable in LumenMap. A future implementation must version and name its adapter balance source and price source/field. |
| **Includes** | Only balances in a documented protocol scope with an available price at the stated snapshot. |
| **Excludes** | Assets outside that scope; positions with no approved price; and duplicate representations of the same underlying assets. Native account balances are not TVL merely because an account is labelled as a protocol. |
| **Limitations** | **Not currently returned by the dashboard or API.** TVL is sensitive to price choice, price time, stale or missing balances, custody/smart-contract scope, and double counting across wrappers, pools, and LP tokens. It must not be inferred from activity, payment volume, or a contract count. |

### Active accounts

| Property | Canonical definition |
| --- | --- |
| **Unit** | One unique Stellar account ID. |
| **Aggregation** | `COUNT(DISTINCT op_source_account)`. An account is active when it is the source account of at least one included operation in the range. |
| **Time basis** | `closed_at BETWEEN @start AND @end`. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`; fields `op_source_account` and `closed_at`. |
| **Includes** | Non-null, non-empty source account IDs with one or more operation rows in the range, across every operation type. A source account is counted once per selected range. |
| **Excludes** | Destination-only accounts, passive accounts referenced in operation payloads, null/empty source IDs, and identities inferred from labels. |
| **Limitations** | **Not currently returned by the dashboard or API.** The existing “Top accounts” treemap query is not active-account count: it is restricted to `ACCOUNT_QUERY_TYPES`, ranks the top 70 accounts per type, and is suitable only for a ranked display. Hubble freshness and partial-period limits apply. |

### Active contracts

| Property | Canonical definition |
| --- | --- |
| **Unit** | One unique non-empty Soroban contract ID observed in the contract activity source. |
| **Aggregation** | `COUNT(DISTINCT contract_id)` after grouping the current query by `contract_id`. The dashboard's current **Active Contracts** KPI equals the number of grouped contract IDs returned, not the sum of their activity. |
| **Time basis** | `hour_agg BETWEEN @start AND @end`, using the common period boundaries. The source is hourly rather than `closed_at` operation rows. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract`; fields `hour_agg`, `contract_id`, and `txn_count`. Implemented by `contractQuery` in `lib/hubble/queries.ts`. |
| **Includes** | Contract IDs that are non-null and non-empty and have a grouped row in the selected hourly aggregate. For each contract, the treemap value is `SUM(txn_count)`—a transaction-activity value, despite the legacy response field name `op_count`. |
| **Excludes** | Null/empty IDs and contracts absent from this aggregate. The KPI also excludes any qualifying ID outside the query's top 200 groups because `contractQuery` applies `LIMIT 200` before `buildKpis` counts the rows. |
| **Limitations** | The KPI is a **top-200 observed active-contract count**, not a network-wide count of all active contracts. It cannot be compared directly with operation counts, and `txn_count` must not be labelled operation count. It may differ from contracts visible in operation-level Soroban data because sources and time grains differ. Hubble freshness, partial periods, cache, and inclusive boundaries apply. |

## Current dashboard field map

| Dashboard/API field or display | Metric it represents | Important qualification |
| --- | --- | --- |
| `kpis.totalOps` / “Total Operations” | Operations | All Hubble operation rows in range. |
| `categories[].op_count` and operation-type treemap values | Operations | Counted by `type_string`. |
| `accounts[].op_count` / account treemap values | Operations attributed to `op_source_account` | Top-70-per-type, selected operation types only; not active accounts and not monetary volume. |
| `contracts[].op_count` / contract treemap values | `SUM(txn_count)` per contract | Legacy field name only; this is transaction activity, not operation count. |
| `kpis.activeContracts` / “Active Contracts” | Active contracts | Top-200 observed contracts as defined above. |
| `kpis.sorobanShare` | Share of operations | Soroban-group operation count divided by Total Operations. |

## Change policy

A change to a metric's source, identity rule, filter, time basis, aggregation,
normalization, or material limitation requires an update to this document and a
methodology version bump. Breaking definition changes require a new major version;
additive clarification uses a minor version; editorial corrections use a patch
version. Historical values calculated under another version must be labelled with
that version rather than silently compared with this one.
