import type { Period } from "@/lib/types";
import {
  SOROBAN_FEE_COLUMNS,
  type SorobanFeeAvailable,
  type SorobanFeeContractRank,
} from "@/lib/soroban-fees/types";

/**
 * Documented fixture sample for the Soroban fee panel.
 * These figures are not live network totals. They stay fixed across periods
 * so fixture mode and tests can assert the same numbers:
 *
 * - total fees: 1,250,000,000 stroops (125 XLM)
 * - invokes: 50,000
 * - non-refundable resource fee: 900,000,000 stroops
 * - average resources per invoke: 18,000 stroops
 *
 * Contract split: 640,000,000 + 410,000,000 + 200,000,000 = 1,250,000,000.
 * Invoke split: 22,000 + 18,000 + 10,000 = 50,000.
 * Resource split: 396,000,000 + 324,000,000 + 180,000,000 = 900,000,000.
 */
export const SOROBAN_FEE_FIXTURE_TOTAL_STROOPS = 1_250_000_000;
export const SOROBAN_FEE_FIXTURE_INVOKE_COUNT = 50_000;
export const SOROBAN_FEE_FIXTURE_RESOURCE_STROOPS = 900_000_000;
export const SOROBAN_FEE_FIXTURE_AVG_RESOURCE_STROOPS = 18_000;

export const SOROBAN_FEE_FIXTURE_NOTE =
  "Fixture sample, not live chain data: 1,250,000,000 stroops of fees across 50,000 invokes, averaging 18,000 stroops of non-refundable resource fee per invoke.";

const FIXTURE_CONTRACTS: SorobanFeeContractRank[] = [
  {
    contractId: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    totalFeeStroops: 640_000_000,
    invokeCount: 22_000,
    resourceStroops: 396_000_000,
  },
  {
    contractId: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
    totalFeeStroops: 410_000_000,
    invokeCount: 18_000,
    resourceStroops: 324_000_000,
  },
  {
    contractId: "CDFIXTURESOROBANFEEANALYTICS0000000000000000000000000000",
    totalFeeStroops: 200_000_000,
    invokeCount: 10_000,
    resourceStroops: 180_000_000,
  },
];

export function buildSorobanFeeFixture(input: {
  period: Period;
  start: string;
  end: string;
}): SorobanFeeAvailable {
  return {
    status: "available",
    source: "fixture",
    period: input.period,
    start: input.start,
    end: input.end,
    totalFeeStroops: SOROBAN_FEE_FIXTURE_TOTAL_STROOPS,
    invokeCount: SOROBAN_FEE_FIXTURE_INVOKE_COUNT,
    avgResourceStroopsPerInvoke: SOROBAN_FEE_FIXTURE_AVG_RESOURCE_STROOPS,
    topContracts: FIXTURE_CONTRACTS.map((row) => ({ ...row })),
    columns: SOROBAN_FEE_COLUMNS,
    note: SOROBAN_FEE_FIXTURE_NOTE,
  };
}
