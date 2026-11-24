# Hubble dashboard query cost notes

This guide identifies the SQL shapes most likely to dominate LumenMap's
BigQuery scan budget. Query names are the stable names exported by
`lib/hubble/shared-queries.mjs`; keep this page and that registry aligned.

Actual bytes depend on the selected period, Hubble partitioning, and upstream
table growth. Run the dry-run helper before and after changing SQL instead of
treating the relative notes below as fixed prices.

## Hot queries

| Registry name | Dashboard purpose | Why it can be expensive | Cost review notes |
| --- | --- | --- | --- |
| `assetPaymentVolumeQuery` | Payment-volume KPI and asset breakdown | Scans payment operations, groups by asset identity, and sums decimal amounts over the full period. | Keep the half-open time predicate intact. Review issuer filters and avoid casting partition columns. |
| `categoryQuery` | Operation-type treemap and total operations | Reads the broad enriched operations table and groups every matching operation by `type_string`. | Period length is the main cost driver. A display limit does not reduce bytes scanned after aggregation. |
| `contractQuery` | Top Soroban contracts | Reads hourly contract fee aggregates and ranks contracts by transaction count. | Preserve the `hour_agg` predicate. `TOP_CONTRACT_LIMIT` limits output rows, not source bytes. |
| `accountQuery` | Top source-account leaderboards | Filters several operation types, then groups and ranks source accounts. | Keep `@types` bounded and parameterized. Review any new operation type for selectivity before adding it. |
| `paymentFlowEdgesQuery` | Flow view edges between payer and destination | Groups payment traffic by both endpoints and asset, producing a high-cardinality aggregation. | This is sensitive to long periods and wide result limits. Check dry-run bytes and row counts together. |
| `sorobanFunctionContractQuery` | Function-by-contract detail | Groups invocation rows by function and contract before applying top-N output bounds. | Function extraction and high cardinality can make wide periods costly; prefer the shortest period that answers the question. |

## Dry-run cost report

The helper validates SQL and asks BigQuery for estimated bytes without running
the query:

```bash
npm run query:costs
```

It reads `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_SERVICE_ACCOUNT_KEY` using the
same local environment convention as the existing Hubble smoke test. Without
credentials it prints a clear skip message and exits successfully, so fixture
contributors are not blocked. It never prints credential contents, project
keys, SQL parameters, or service-account JSON.

The report uses a rolling 24-hour interval. Compare the same interval before
and after a query edit. BigQuery estimates are advisory; a successful dry run
does not prove that live rows have the expected semantics.

## Contributor checklist

- [ ] Query name still matches `queryRegistry`.
- [ ] Time predicates remain parameterized and use the documented Hubble time column.
- [ ] Dry-run bytes were recorded before and after the SQL change when credentials were available.
- [ ] Output limits are not described as scan limits.
- [ ] No project ID, credential path, service-account JSON, or query parameter values were committed.
- [ ] Fixture mode and the relevant unit tests still pass without credentials.

