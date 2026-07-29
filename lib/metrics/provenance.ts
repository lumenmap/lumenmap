import { TOP_CONTRACT_LIMIT } from "@/lib/constants";
import type { ActiveContractsProvenance, ActivityProvenance } from "@/lib/types";

export function buildActiveContractsProvenance(): ActiveContractsProvenance {
  return {
    metric: "activeContracts",
    aggregation: "uncapped_distinct_count",
    source: "hourly_soroban_fee_agg_contract",
    query: "activeContractCountQuery",
    leaderboardLimit: TOP_CONTRACT_LIMIT,
  };
}

export function buildActivityProvenance(): ActivityProvenance {
  return {
    activeContracts: buildActiveContractsProvenance(),
  };
}
