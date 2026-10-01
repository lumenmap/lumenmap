import {
  methodologyPath,
  type MethodologySectionId,
} from "@/lib/metrics/methodology";

export type KpiMetricId =
  | "totalOps"
  | "sorobanShare"
  | "topCategory"
  | "activeContracts"
  | "activeWallets"
  | "activeDestinationAccounts";

export interface MetricDefinition {
  id: KpiMetricId;
  title: string;
  definition: string;
  unit: string;
  limitation: string;
  methodologySection: MethodologySectionId;
  methodologyHref: string;
  sparkline?: boolean;
}

export const METRIC_DEFINITIONS: Record<KpiMetricId, MetricDefinition> = {
  totalOps: {
    id: "totalOps",
    title: "Total Operations",
    definition:
      "Number of closed Stellar operations in the selected period, summed across operation types.",
    unit: "operations (count)",
    limitation:
      "Not a transaction count; Hubble lag can understate the latest partial day.",
    methodologySection: "operations",
    methodologyHref: methodologyPath("operations"),
    sparkline: true,
  },
  sorobanShare: {
    id: "sorobanShare",
    title: "Soroban Share",
    definition:
      "Percentage of period operations whose type maps to the Soroban category.",
    unit: "percent of operations",
    limitation:
      "Uses LumenMap category mapping; undefined when total operations are zero.",
    methodologySection: "soroban-share",
    methodologyHref: methodologyPath("soroban-share"),
    sparkline: true,
  },
  topCategory: {
    id: "topCategory",
    title: "Top Category",
    definition:
      "Activity category with the largest operation count in the selected period.",
    unit: "category label",
    limitation:
      "Categorical ranking of grouped types, not asset volume or unique users.",
    methodologySection: "top-category",
    methodologyHref: methodologyPath("top-category"),
  },
  activeContracts: {
    id: "activeContracts",
    title: "Active Contracts",
    definition:
      "Count of Soroban contracts with fee / invoke activity in the period, as returned by the contract activity query.",
    unit: "contracts (count)",
    limitation:
      "The current KPI uses the leaderboard result length, which is capped (top 200), so busy periods can undercount.",
    methodologySection: "active-contracts",
    methodologyHref: methodologyPath("active-contracts"),
  },
  activeWallets: {
    id: "activeWallets",
    title: "Active Wallets",
    definition:
      "Distinct Stellar account public keys that sourced at least one operation in the selected period.",
    unit: "accounts (distinct count)",
    limitation:
      "Counts source accounts only; receiving-side activity is tracked separately.",
    methodologySection: "active-accounts",
    methodologyHref: methodologyPath("active-accounts"),
  },
  activeDestinationAccounts: {
    id: "activeDestinationAccounts",
    title: "Active Destinations",
    definition:
      "Distinct classic (G...) accounts that received qualifying payment, path-payment, account-creation, or merge operations in the period.",
    unit: "accounts (distinct count)",
    limitation:
      "Destination semantics differ from source wallets; contract recipients and muxed accounts are excluded.",
    methodologySection: "active-destination-accounts",
    methodologyHref: methodologyPath("active-destination-accounts"),
  },
};

export const DASHBOARD_METRIC_IDS = Object.keys(
  METRIC_DEFINITIONS,
) as KpiMetricId[];

export function getMetricDefinition(id: KpiMetricId): MetricDefinition {
  return METRIC_DEFINITIONS[id];
}
