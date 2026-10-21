import type { Period } from "@/lib/types";

/** Hubble table the fee panel reads. Columns are optional at runtime. */
export const SOROBAN_FEE_SOURCE_TABLE =
  "crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract";

/**
 * Columns the fee queries reference. `hour_agg` is the time predicate.
 * `txn_count` is the invoke denominator. Fee and resource amounts are stroops.
 */
export const SOROBAN_FEE_COLUMNS = [
  "hour_agg",
  "contract_id",
  "txn_count",
  "total_fee_charged",
  "total_non_refundable_resource_fee",
] as const;

export type SorobanFeeColumn = (typeof SOROBAN_FEE_COLUMNS)[number];

export type SorobanFeeUnavailableReason = "schema_drift" | "query_failed";

export interface SorobanFeeContractRank {
  contractId: string;
  totalFeeStroops: number;
  invokeCount: number;
  resourceStroops: number;
}

export interface SorobanFeeAvailable {
  status: "available";
  source: "hubble" | "fixture";
  period: Period;
  start: string;
  end: string;
  totalFeeStroops: number;
  invokeCount: number;
  /**
   * Non-refundable resource fee stroops divided by invoke count.
   * Null when the period has no invokes, so the ratio is undefined.
   */
  avgResourceStroopsPerInvoke: number | null;
  topContracts: SorobanFeeContractRank[];
  columns: readonly SorobanFeeColumn[];
  note: string;
}

export interface SorobanFeeUnavailable {
  status: "unavailable";
  source: "hubble";
  period: Period;
  start: string;
  end: string;
  reason: SorobanFeeUnavailableReason;
  message: string;
}

export type SorobanFeeAnalytics = SorobanFeeAvailable | SorobanFeeUnavailable;

/** Numeric core produced by the mapper, before period metadata is attached. */
export interface SorobanFeeMapped {
  totalFeeStroops: number;
  invokeCount: number;
  resourceStroops: number;
  avgResourceStroopsPerInvoke: number | null;
  topContracts: SorobanFeeContractRank[];
}
