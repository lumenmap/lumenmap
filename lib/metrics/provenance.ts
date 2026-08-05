import {
  TOP_ACCOUNTS_PER_TYPE,
  TOP_CONTRACT_LIMIT,
  TOP_CONTRACTS_PER_FUNCTION,
  TOP_SOROBAN_FUNCTIONS,
} from "@/lib/constants";
import type {
  ActivityMetricProvenance,
  CoverageConstraint,
} from "@/lib/types";

const COMMON_COVERAGE: CoverageConstraint[] = [
  {
    kind: "time_bounds",
    semantics: "inclusive",
    startField: "start",
    endField: "end",
  },
  { kind: "partial_period", completenessField: "isPeriodComplete" },
  { kind: "source_lag", watermarkField: "sourceTimestamp" },
];

export function buildActivityMetricProvenance(): ActivityMetricProvenance {
  return {
    operation_count: {
      metric: "operation_count",
      methodology: {
        id: "operations",
        version: "1.0.0",
        href: "docs/metric-methodology.md#operations",
      },
      source: {
        provider: "hubble",
        dataset: "crypto-stellar.crypto_stellar_dbt",
        tables: [
          "enriched_history_operations",
          "enriched_history_operations_soroban",
          "hourly_soroban_fee_agg_contract",
        ],
      },
      aggregation: {
        kind: "count",
        function: "COUNT(*)",
        granularity: "selected_period",
        dimensions: ["type_string"],
      },
      coverage: {
        network: "stellar_mainnet",
        constraints: [
          ...COMMON_COVERAGE,
          {
            kind: "top_n",
            appliesTo: "account_children",
            limit: TOP_ACCOUNTS_PER_TYPE,
            partitionBy: "type_string",
          },
          {
            kind: "top_n",
            appliesTo: "contract_children",
            limit: TOP_CONTRACT_LIMIT,
          },
          {
            kind: "top_n",
            appliesTo: "soroban_function_children",
            limit: TOP_SOROBAN_FUNCTIONS,
          },
          {
            kind: "top_n",
            appliesTo: "contracts_per_function",
            limit: TOP_CONTRACTS_PER_FUNCTION,
            partitionBy: "function_name",
          },
        ],
      },
    },
    asset_volume: {
      metric: "asset_volume",
      methodology: {
        id: "payment-volume",
        version: "1.0.0",
        href: "docs/metric-methodology.md#payment-volume",
      },
      source: {
        provider: "hubble",
        dataset: "crypto-stellar.crypto_stellar_dbt",
        tables: ["enriched_history_operations"],
      },
      aggregation: {
        kind: "sum",
        field: "amount",
        granularity: "selected_period",
        dimensions: ["type_string", "asset_identity"],
      },
      coverage: {
        network: "stellar_mainnet",
        constraints: [
          ...COMMON_COVERAGE,
          {
            kind: "filter",
            field: "asset_type",
            operator: "equals",
            value: "native",
          },
          {
            kind: "top_n",
            appliesTo: "account_children",
            limit: TOP_ACCOUNTS_PER_TYPE,
            partitionBy: "type_string",
          },
        ],
      },
    },
  };
}
