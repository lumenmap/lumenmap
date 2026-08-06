import {
  methodologyPath,
  type MethodologySectionId,
} from "@/lib/metrics/methodology";

export type KpiMetricId =
  | "totalOps"
  | "sorobanShare"
  | "topCategory"
  | "activeContracts";

export interface MetricDefinition {
  id: KpiMetricId;
  title: string;
  /** One or two sentences at the point of use. */
  definition: string;
  unit: string;
  /** Primary limitation / exclusion called out inline. */
  limitation: string;
  methodologySection: MethodologySectionId;
  methodologyHref: string;
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
      "Count of Soroban contracts with activity returned for the period contract query.",
    unit: "contracts (count)",
    limitation:
      "Currently derived from a top-200 leaderboard result, so busy periods can undercount.",
    methodologySection: "active-contracts",
    methodologyHref: methodologyPath("active-contracts"),
  },
};

export const DASHBOARD_METRIC_IDS = Object.keys(
  METRIC_DEFINITIONS,
) as KpiMetricId[];

export function getMetricDefinition(id: KpiMetricId): MetricDefinition {
  return METRIC_DEFINITIONS[id];
}
