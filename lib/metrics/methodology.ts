/**
 * Canonical metric methodology (v0.1).
 * Inline UI definitions link to these section ids via /methodology#<id>.
 */

export const METHODOLOGY_VERSION = "0.1";

export type MethodologySectionId =
  | "operations"
  | "transactions"
  | "payment-volume"
  | "tvl"
  | "active-accounts"
  | "active-contracts"
  | "soroban-share"
  | "top-category"
  | "time-basis"
  | "hubble-freshness";

export interface MethodologySection {
  id: MethodologySectionId;
  title: string;
  summary: string;
  unit: string;
  aggregation: string;
  timeBasis: string;
  source: string;
  inclusions: string[];
  exclusions: string[];
  limitations: string[];
}

export const METHODOLOGY_SECTIONS: MethodologySection[] = [
  {
    id: "operations",
    title: "Operations",
    summary:
      "Count of Stellar operations closed in the selected period, grouped by operation type.",
    unit: "operations (count)",
    aggregation: "COUNT(*) of operations; dashboard totals sum type counts.",
    timeBasis:
      "Inclusive wall-clock period using the server period resolver (Today, last 7/30 days, or calendar month).",
    source:
      "`crypto-stellar.crypto_stellar_dbt.enriched_history_operations.type_string` filtered by `closed_at`.",
    inclusions: [
      "All operation types present in Hubble for the period",
      "Soroban and classic operations",
    ],
    exclusions: [
      "Failed or non-closed operations not present in the enriched closed-at feed",
      "Mempool / unconfirmed activity",
    ],
    limitations: [
      "This is not a transaction count; one transaction may contain multiple operations.",
      "Hubble batch lag can understate the most recent partial day.",
    ],
  },
  {
    id: "transactions",
    title: "Transactions",
    summary:
      "Count of distinct transactions that closed in the selected period. Not currently shown as a dashboard KPI.",
    unit: "transactions (count)",
    aggregation: "COUNT(DISTINCT transaction hash / id) over closed transactions.",
    timeBasis: "Same selected period bounds as operations.",
    source:
      "Hubble transaction / operation linkage tables (planned surface; not queried by the current KPI cards).",
    inclusions: ["Closed transactions in the period"],
    exclusions: [
      "Operations within a transaction are not counted here",
      "Unconfirmed submissions",
    ],
    limitations: [
      "Transaction count and operation count are different metrics and must not be compared as equivalents.",
      "Not exposed in the current dashboard UI.",
    ],
  },
  {
    id: "payment-volume",
    title: "Payment volume",
    summary:
      "Asset-denominated payment amounts moved in the period. Not currently shown as a dashboard KPI.",
    unit: "asset units (for example XLM or USDC), never a mixed-asset total without normalization",
    aggregation:
      "SUM of payment amounts per asset code/issuer. Cross-asset totals require an explicit FX normalization rule.",
    timeBasis: "Same selected period bounds as operations.",
    source: "Hubble payment amount fields on enriched payment operations (planned).",
    inclusions: ["Payment and path-payment style transfers when enabled"],
    exclusions: [
      "Non-payment operation types",
      "Unnormalized multi-asset rollups",
    ],
    limitations: [
      "LumenMap does not present a single cross-asset volume total without a documented normalization method.",
      "Not exposed in the current dashboard UI.",
    ],
  },
  {
    id: "tvl",
    title: "TVL (total value locked)",
    summary:
      "Point-in-time estimate of value committed to protocols at a snapshot. Not currently shown as a dashboard KPI.",
    unit: "quoted currency at snapshot time (for example USD), after documented pricing",
    aggregation:
      "Sum of protocol balances at a timestamp; protocol adapters must state double-counting rules.",
    timeBasis: "Point-in-time snapshot, not a period sum.",
    source: "Protocol-specific reserve / pool state (planned; no default adapter yet).",
    inclusions: ["Balances explicitly held by supported protocol contracts"],
    exclusions: [
      "Wallet balances not locked in a protocol",
      "Unpriced or unverifiable reserves",
    ],
    limitations: [
      "TVL is sensitive to oracle price choice and can double-count assets bridged across protocols.",
      "Not exposed in the current dashboard UI.",
    ],
  },
  {
    id: "active-accounts",
    title: "Active accounts",
    summary:
      "Distinct account public keys that sourced qualifying operations in the period. Not currently a KPI card.",
    unit: "accounts (distinct count)",
    aggregation: "COUNT(DISTINCT op_source_account) for selected operation types.",
    timeBasis: "Same selected period bounds as operations.",
    source:
      "`enriched_history_operations.op_source_account` (leaderboard queries today return top-N per type, not the full distinct set).",
    inclusions: ["Accounts that appear as operation source accounts"],
    exclusions: [
      "Accounts that only receive payments without sourcing ops in the filtered set",
      "Contract IDs",
    ],
    limitations: [
      "The treemap account list is top-N capped per operation type and is not the full active-account universe.",
      "Not exposed as a dedicated KPI card yet.",
    ],
  },
  {
    id: "active-contracts",
    title: "Active contracts",
    summary:
      "Soroban contracts with fee / invoke activity in the period, as returned by the contract activity query.",
    unit: "contracts (count)",
    aggregation:
      "Number of contract IDs returned by the period contract leaderboard query after grouping.",
    timeBasis: "Same selected period bounds as operations.",
    source:
      "`crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract` grouped by `contract_id` with null/empty IDs removed.",
    inclusions: ["Contracts with non-empty contract_id and activity in-range"],
    exclusions: ["Null or empty contract IDs", "Non-contract classic accounts"],
    limitations: [
      "The current KPI uses the leaderboard result length, which is capped (top 200), so busy periods can undercount.",
      "Hubble lag can delay the newest hours.",
    ],
  },
  {
    id: "soroban-share",
    title: "Soroban share",
    summary:
      "Share of period operations whose type maps to the Soroban category.",
    unit: "percent of operations",
    aggregation:
      "(Soroban-category operation count / total operation count) × 100.",
    timeBasis: "Same selected period bounds as operations.",
    source:
      "Derived from operation type totals using LumenMap category mapping (`invoke_host_function`, footprint ops → Soroban).",
    inclusions: ["Operations mapped to the Soroban category"],
    exclusions: ["Classic payment, DEX, trustline, and account categories"],
    limitations: [
      "Category mapping is product-defined; raw Hubble types remain available in treemap drill-down.",
      "Undefined when total operations are zero.",
    ],
  },
  {
    id: "top-category",
    title: "Top category",
    summary:
      "The LumenMap activity category with the largest operation count in the period.",
    unit: "category label",
    aggregation: "Argmax of summed operation counts across category groups.",
    timeBasis: "Same selected period bounds as operations.",
    source: "Derived from operation type totals and `TYPE_TO_GROUP` mapping.",
    inclusions: [
      "Soroban, Payments, DEX, Trustlines, Account Operations, Other",
    ],
    exclusions: ["Entity-level rankings (accounts/contracts)"],
    limitations: [
      "Ties resolve by sort order of aggregated totals; label is categorical, not a numeric volume.",
    ],
  },
  {
    id: "time-basis",
    title: "Time basis and partial periods",
    summary:
      "How LumenMap bounds Today, multi-day windows, and the calendar month.",
    unit: "n/a",
    aggregation: "n/a",
    timeBasis:
      "Period start/end come from the dashboard period control. The current day or month can be partial until the period ends.",
    source: "`lib/periods.ts` period resolver used by `/api/activity`.",
    inclusions: ["Closed operations with `closed_at` inside the resolved bounds"],
    exclusions: ["Activity outside the selected bounds"],
    limitations: [
      "Partial current periods are expected to grow as new Hubble batches arrive.",
      "Host timezone can affect local period boundaries until an explicit UTC policy is enforced.",
    ],
  },
  {
    id: "hubble-freshness",
    title: "Hubble freshness",
    summary:
      "Analytics numbers follow Hubble’s batch refresh, not sub-second chain tip state.",
    unit: "n/a",
    aggregation: "n/a",
    timeBasis: "Intraday Hubble batches; exact lag varies.",
    source: "Stellar Hubble BigQuery datasets.",
    inclusions: ["Data present in the Hubble tables at query time"],
    exclusions: ["Unindexed tip activity"],
    limitations: [
      "Recent intervals can under-report until the next Hubble refresh.",
      "API responses may be cached for several minutes server-side.",
    ],
  },
];

export function getMethodologySection(
  id: MethodologySectionId,
): MethodologySection {
  const section = METHODOLOGY_SECTIONS.find((entry) => entry.id === id);
  if (!section) {
    throw new Error(`Unknown methodology section: ${id}`);
  }
  return section;
}

export function methodologyPath(id: MethodologySectionId): string {
  return `/methodology#${id}`;
}
