# LumenMap metric methodology

**Methodology version:** 2.0.0\
**Status:** Canonical for the current mainnet dashboard and its planned metrics  
**Last updated:** 2026-09-30

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
  independently run adjacent ranges. The dashboard and `GET /api/v1/timeseries`
  publish bucketed operation/transaction totals per request, but ad-hoc sums of
  independently run adjacent ranges remain subject to this boundary overlap and
  must not be treated as an exact additive series without accounting for it.
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
  ingested, not through the requested end timestamp. Every response carries an
  `isPeriodComplete` completeness flag and a `sourceTimestamp` Hubble watermark;
  consumers must treat every range containing the current day as
  **partial / provisional**.
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
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`; `transaction_hash` and `closed_at`. Implemented by `transactionCategoryQuery` in `lib/hubble/shared-queries.mjs` (per-type `COUNT(DISTINCT transaction_hash)`) and the hourly/daily timeseries queries (`COUNT(DISTINCT transaction_id)` per UTC bucket). |
| **Includes** | Unique transactions represented by the selected source rows in the range. |
| **Excludes** | Transactions absent from that operation dataset, including any transaction with no represented operation row. |
| **Limitations** | Returned by the dashboard and API as the `txn_events` / `txn_actors` treemaps, the operations-vs-transactions time-series chart, and `GET /api/v1/timeseries`. It must not be substituted with Total Operations or any treemap value. It shares Hubble freshness and partial-period limitations. |

An operation count and a transaction count are deliberately different metrics. In
particular, summing operation-type counts must never be labelled “transactions.”

### Payment volume

**Methodology ID:** `payment-volume` · **Version:** `1.0.0`

| Property | Canonical definition |
| --- | --- |
| **Unit** | Amount in the payment asset's native units, reported separately for each asset identity. |
| **Aggregation** | `SUM(amount)` grouped by `(asset_code, asset_issuer)`; native XLM must be its own explicit asset bucket. No sum across asset buckets is a payment-volume metric. |
| **Time basis** | `closed_at BETWEEN @start AND @end`. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`; direct payment rows (`type_string = 'payment'`) and their `amount`, `asset_code`, `asset_issuer`, and `closed_at` fields. Implemented by `assetPaymentVolumeQuery` (per-asset grouping that preserves issuer identity), the native-XLM treemaps, the verified Circle USDC treemaps (see [USDC payment volume](#usdc-payment-volume)), and the per-asset payment-volume panel. |
| **Includes** | Successful direct `payment` operation amounts represented in Hubble, attributed to the asset sent by the operation. |
| **Excludes** | Path-payment operations, `create_account` starting balances, DEX trades, liquidity-pool flows, fees, and any non-payment operation. They require separate definitions and are not payment volume. |
| **Limitations** | Returned by the dashboard and API for XLM and verified Circle USDC; unsupported same-code assets are excluded from the USDC scope. Asset units have different meanings and decimals; displaying “total volume” across XLM, issued assets, or other assets is prohibited unless a separately documented versioned normalization specifies the price source, quote currency, timestamp, missing-price policy, and aggregation. Hubble freshness and partial-period limits apply. |

### USDC payment volume

**Methodology ID:** `usdc-payment-volume` · **Version:** `1.0.0`

| Property | Canonical definition |
| --- | --- |
| **Unit** | Amount in USDC native units, reported only for the verified asset set below. |
| **Aggregation** | `SUM(amount)` grouped by `(asset_code, asset_issuer)` and filtered to the supported set; same-code assets with different issuers remain separate rows and only supported issuers contribute. |
| **Time basis** | `closed_at BETWEEN @start AND @end`. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations` with the asset allow-list in `data/usdc-assets.json` (`stellar-mainnet-circle-usdc-v1`: Circle USDC on Stellar mainnet, issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`). Implemented by `usdcPaymentVolumeQuery`, `usdcCategoryQuery`, and `usdcAccountQuery` in `lib/hubble/shared-queries.mjs`. |
| **Includes** | Payment amounts whose `(asset_code, asset_issuer)` matches the supported set. |
| **Excludes** | Same-code USDC issued by any other issuer; path-payment operations, `create_account` starting balances, DEX trades, liquidity-pool flows, fees, and any non-payment operation. |
| **Limitations** | A scoped view of the [Payment volume](#payment-volume) metric, subject to the same prohibitions on cross-asset totals and the same Hubble freshness and partial-period limits. Unsupported on Stellar testnet. |

### Total value locked (TVL)

**Methodology ID:** `total-value-locked` · **Version:** `1.0.0`

| Property | Canonical definition |
| --- | --- |
| **Unit** | A fiat quote currency amount (for example, USD), plus the quote currency and snapshot timestamp. |
| **Aggregation** | Sum the priced balances in the approved protocol scope at one snapshot time. Aggregate only after deduplicating the underlying economic positions; do not sum both a pool share/LP token and the pool's underlying reserves. |
| **Time basis** | **Point in time**, never a daily or period sum. A TVL result must state its `asOf` timestamp and pricing timestamp. |
| **Source** | Per-protocol adapters defined by `ProtocolTvlAdapter` in `lib/tvl/adapter.ts` and assembled by `buildProtocolTvlTreemap` in `lib/tvl/build-protocol-treemap.ts`. The dashboard's current snapshots are fixture-backed adapter results (`PROTOCOL_TVL_FIXTURE_RESULTS` in `lib/tvl/protocol-registry.ts`) with per-protocol snapshot times, USD values, and price provenance. A live Hubble/venue adapter with a versioned price pipeline is still pending (see `docs/tvl-methodology.md`, which remains the adapter design reference). |
| **Includes** | Only balances in a documented protocol scope with an available price at the stated snapshot. |
| **Excludes** | Assets outside that scope; positions with no approved price; and duplicate representations of the same underlying assets. Native account balances are not TVL merely because an account is labelled as a protocol. |
| **Limitations** | Returned by the dashboard as the **Protocol TVL** treemap metric with `complete` / `partial` / `stale` / `unsupported` / `failed` adapter status kept visible; unsupported and failed adapters are omitted from tile sizing but stay visible via status metadata. Partial and stale snapshots remain usable but must be labelled as such. TVL is sensitive to price choice, price time, stale or missing balances, custody/smart-contract scope, and double counting across wrappers, pools, and LP tokens. It must not be inferred from activity, payment volume, or a contract count. Unsupported on Stellar testnet. |

### Active accounts

| Property | Canonical definition |
| --- | --- |
| **Unit** | One unique Stellar account ID. |
| **Aggregation** | `COUNT(DISTINCT op_source_account)`. An account is active when it is the source account of at least one included operation in the range. |
| **Time basis** | `closed_at BETWEEN @start AND @end`. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`; fields `op_source_account` and `closed_at`. Implemented by `activeSourceAccountsQuery` (live) with deterministic fixture counts in fixture mode. Destination counts use the destination fields (`details.to`, `details.new_account`, `details.into`) for the documented payment-style types via `activeDestinationCountQuery`. |
| **Includes** | Non-null, non-empty source account IDs with one or more operation rows in the range, across every operation type. A source account is counted once per selected range. |
| **Excludes** | Destination-only accounts, passive accounts referenced in operation payloads, null/empty source IDs, and identities inferred from labels. |
| **Limitations** | Returned by the dashboard and API as the **Active Wallets** and **Active Destinations** KPI cards. The existing “Top accounts” treemap query is not active-account count: it is restricted to `ACCOUNT_QUERY_TYPES`, ranks the top 70 accounts per type, and is suitable only for a ranked display. Hubble freshness and partial-period limits apply. |

### Active destination accounts

**Methodology ID:** `active-destination-accounts` · **Version:** `1.0.0`

| Property | Canonical definition |
| --- | --- |
| **Unit** | One unique Stellar destination account ID. |
| **Aggregation** | `COUNT(DISTINCT destination_account)` across payment-style operation types. |
| **Time basis** | `closed_at BETWEEN @start AND @end`. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.enriched_history_operations`; destination fields (`to`, `account`, `into`) for selected types (`payment`, `path_payment_strict_receive`, `path_payment_strict_send`, `create_account`, `account_merge`). |
| **Includes** | Classic `G...` accounts receiving qualifying operations in the period. |
| **Excludes** | Source-only accounts, contract IDs, empty identifiers, and muxed (`M...`) accounts. |
| **Limitations** | Destination semantics differ from source active wallets; do not sum the two KPIs as a deduplicated user count. Only the documented operation types contribute to the destination count. |

### Active contracts

| Property | Canonical definition |
| --- | --- |
| **Unit** | One unique non-empty Soroban contract ID observed in the contract activity source. |
| **Aggregation** | `COUNT(DISTINCT contract_id)` after grouping the current query by `contract_id`. The dashboard's live **Active Contracts** KPI prefers the uncapped distinct count (`activeContractCountQuery`) when available, so it is not coupled to the capped leaderboard length; in fixture mode it equals the number of grouped contract IDs returned. |
| **Time basis** | `hour_agg BETWEEN @start AND @end`, using the common period boundaries. The source is hourly rather than `closed_at` operation rows. |
| **Source** | `crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract`; fields `hour_agg`, `contract_id`, and `txn_count`. Implemented by `contractQuery` (top-200 leaderboard for treemaps) and `activeContractCountQuery` (uncapped KPI count) in `lib/hubble/shared-queries.mjs`. |
| **Includes** | Contract IDs that are non-null and non-empty and have a grouped row in the selected hourly aggregate. For each contract, the treemap value is `SUM(txn_count)`—a transaction-activity value, despite the legacy response field name `op_count`. |
| **Excludes** | Null/empty IDs and contracts absent from this aggregate. Treemap contract children also exclude any qualifying ID outside the query's top 200 groups because `contractQuery` applies `LIMIT 200`. |
| **Limitations** | Treemap contract children are a **top-200 observed** view, not the network-wide universe, and cannot be compared directly with operation counts; `txn_count` must not be labelled operation count. The live KPI is the uncapped distinct count and may therefore exceed the contracts visible in the treemap. Values may differ from contracts visible in operation-level Soroban data because sources and time grains differ. Hubble freshness, partial periods, cache, and inclusive boundaries apply. |

## Payment-flow graph

**Anchors:** `/methodology#flow`, `#flow-nodes`, `#flow-edges`, `#flow-sampling`,
`#flow-asset-modes` (exported from `lib/metrics/flow-methodology-anchors.ts`).

The Flow view is a directed graph of value movement between accounts in the
selected period. It is a descriptive sample, not a complete transfer ledger, and
follows the common conventions above.

- **Nodes.** One Stellar account ID that is the source or destination of at least
  one rendered edge. Labels change display names only. Node metrics (in/out
  operation count, in/out degree, in/out volume per asset) describe the sample,
  not network-wide account totals. An empty ego result retains the selected
  account node so the empty state can identify it.
- **Edges.** Source → destination of a successful `payment`,
  `path_payment_strict_send`, `path_payment_strict_receive`, `create_account`
  (funding edge), or `account_merge` (drain edge) operation. Operations for the
  same `(source, destination, asset)` collapse into one edge summing amount and
  operation count. Failed operations, self-payments, rows missing a source or
  destination, and other operation types are excluded. Edge amounts are not the
  Payment volume metric, which counts direct `payment` operations only.
  Funding and account-drain rows without a reliable amount are counted as
  operations, but their edge has `amountComplete: false` and the UI suppresses
  the partial amount.
- **Sampling and coverage.** Only the top 100 edges, ranked by operation count
  and then by amount within the same asset, are returned. The API sets
  `sampled` when more edges exist. An absent edge can therefore be outside the
  sample rather than absent from the network.
- **Asset modes.** Each edge has exactly one asset identity (code + issuer;
  native XLM is explicit). For `asset_type = 'native'`, use one XLM identity
  regardless of null code/issuer; for issued assets, require a non-empty code
  and issuer and keep `(asset_type, asset_code, asset_issuer)` together. An
  asset mode such as XLM or USDC filters to one exact identity before ranking
  and coverage calculation. Amounts across assets must not be summed or used
  as a cross-asset ranking key; no price conversion is applied.

The [Flow ADR](adr/payment-flow.md) links to these rules. The
[Hubble enriched operations schema](https://developers.stellar.org/docs/data/analytics/hubble/data-catalog/data-dictionary/silver/enriched-history-operations)
documents the flattened columns and transaction success flag.

## Current dashboard field map

| Dashboard/API field or display | Metric it represents | Important qualification |
| --- | --- | --- |
| `kpis.totalOps` / “Total Operations” | Operations | All Hubble operation rows in range. |
| `categories[].op_count` and operation-type treemap values | Operations | Counted by `type_string`. |
| `accounts[].op_count` / source treemap values | Operations attributed to `op_source_account` | Top-70-per-type, selected operation types only; not active accounts and not monetary volume. |
| `destinationAccounts[].op_count` / receiver treemap values | Operations attributed to destination fields | Top-70-per-type, payment-style types only; extracts `to`, `account`, or `into` fields based on operation type. |
| `contracts[].op_count` / contract treemap values | `SUM(txn_count)` per contract | Legacy field name only; this is transaction activity, not operation count. |
| `txn_events` / `txn_actors` treemaps and the Transaction Count metric | Transactions | `COUNT(DISTINCT transaction_hash)` per type; never labelled operations. |
| Time-series chart and `GET /api/v1/timeseries` buckets | Operations and Transactions | UTC buckets (`hour` for `1d`, otherwise `day`) with partial-bucket flags and series totals. |
| `xlm_events` / `xlm_actors` treemaps and the XLM Volume metric | Payment volume (XLM scope) | Native-asset amounts as decimal strings; unsupported on testnet. |
| `usdc_events` / `usdc_actors` treemaps and the USDC Volume metric | USDC payment volume | Verified Circle USDC set only; same-code other-issuer assets excluded; unsupported on testnet. |
| Per-asset payment-volume panel (`assetVolumes`) | Payment volume (per-asset) | Native units per asset identity; issuers kept distinct, never summed. |
| `protocol_tvl` treemap and the Protocol TVL metric | Total value locked | Point-in-time adapter snapshots in USD with per-protocol status; fixture-backed until live adapters land; unsupported on testnet. |
| `kpis.activeContracts` / “Active Contracts” | Active contracts | Uncapped distinct count live; leaderboard length in fixture mode (see above). |
| `kpis.activeWallets` / “Active Wallets” | Active accounts (source) | Distinct source accounts; receiving-side activity is separate. |
| `kpis.activeDestinationAccounts` / “Active Destinations” | Active accounts (destination) | Distinct receiving accounts for qualifying payment-style types; do not sum with source wallets. |
| `kpis.sorobanShare` | Share of operations | Soroban-group operation count divided by Total Operations. |

## Change policy

A change to a metric's source, identity rule, filter, time basis, aggregation,
normalization, or material limitation requires an update to this document and a
methodology version bump. Breaking definition changes require a new major version;
additive clarification uses a minor version; editorial corrections use a patch
version. Historical values calculated under another version must be labelled with
that version rather than silently compared with this one.


## KPI query degradation strategy

When an optional KPI query fails (timeout, schema drift, BigQuery quota exceeded, etc.), LumenMap does not fail the entire `/api/v1/activity` response. Instead, the optional query soft-fails: it returns a fallback value, logs the error with correlation ID and query name, and increments a telemetry counter.

### Query classification

**Required queries** — failure causes HTTP 500:
- `assetPaymentVolume`, `category`, `contract`, `account`, `sorobanFunction`, `sorobanFunctionContract`, `activeSourceAccounts`
- `timeseries`, `heatmap`

These queries power the core treemap and are necessary for a valid activity response. If any required query fails, the caller receives a safe HTTP 500 error (no SQL or parameter details are leaked).

**Optional queries** — failure returns fallback, HTTP 200:
- `transactionCategory`: Treemap loses `txn_events` and `txn_actors` views; operation/transaction counts still available
- `usdcCategory`, `usdcAccount`: USDC-specific treemaps show empty; the core operation-count treemaps remain
- `activeDestinationCount`: Active destination KPI card shows 0; other KPIs remain
- `activeContractCount`: Active contract KPI card shows 0; other KPIs remain
- `accountMetadata` (home_domain labels): Labels are unavailable; addresses still display

### Implementation

Optional queries use `runOptionalQuery` (in `lib/hubble/soft-fail.ts`), which:
1. Attempts to run the query
2. On failure, logs a structured `activity.query.soft_fail` event including `correlationId`, `queryName`, `errorClass`, and `errorMessage`
3. Records a counter keyed by `(queryName, errorClass)` for monitoring
4. Returns a typed fallback value (usually `[]` or a zero-valued object)
5. Allows the activity dataset to build successfully with degraded KPIs

Consumers see no difference in the HTTP response contract; optional KPI fields simply carry zero or empty values when the upstream query fails.

### Monitoring soft failures

Every soft failure is:
- Logged with `event: "activity.query.soft_fail"` and a `correlationId` for tracing
- Counted in telemetry under `{ endpoint: "activity", query_outcome: "soft_fail", query_name: "<name>", error_class: "<class>" }`

Operators can alert on soft-failure rates per query name. A query with rising soft-failure rates signals a need for troubleshooting (e.g., BigQuery quota, schema change, or Hubble data lag).

### Version history

- **2.0.0 (current):** Optional query soft-failure for activeDestinationCount, activeContractCount, and transactionCategory queries.
