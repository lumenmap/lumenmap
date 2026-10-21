import { TOP_SOROBAN_FEE_CONTRACTS } from "@/lib/hubble/shared-queries.mjs";
import type {
  SorobanFeeContractRank,
  SorobanFeeMapped,
} from "@/lib/soroban-fees/types";

/**
 * Coerce a BigQuery cell to a finite number.
 * Null, blank, and non-numeric cells become 0 so a null aggregate row
 * still produces a typed result.
 */
export function mapFeeNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && "value" in value) {
    return mapFeeNumber((value as { value: unknown }).value);
  }
  return 0;
}

function asRowList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function mapContractRow(value: unknown): SorobanFeeContractRank | null {
  const row = asRecord(value);
  if (!row) return null;
  const contractId =
    typeof row.contract_id === "string" ? row.contract_id.trim() : "";
  if (contractId === "") return null;
  return {
    contractId,
    totalFeeStroops: mapFeeNumber(row.total_fee_stroops),
    invokeCount: mapFeeNumber(row.invoke_count),
    resourceStroops: mapFeeNumber(row.resource_stroops),
  };
}

/**
 * Map summary and contract leaderboard rows.
 * A null summary row, a missing row, or null numeric cells yield zeros.
 * Null contract rows and blank contract ids are dropped.
 */
export function mapSorobanFeeRows(input: {
  summaryRows: unknown;
  contractRows: unknown;
}): SorobanFeeMapped {
  const summary = asRowList(input.summaryRows)
    .map(asRecord)
    .find((row): row is Record<string, unknown> => row !== null);

  const totalFeeStroops = mapFeeNumber(summary?.total_fee_stroops);
  const invokeCount = mapFeeNumber(summary?.invoke_count);
  const resourceStroops = mapFeeNumber(summary?.resource_stroops);

  const topContracts = asRowList(input.contractRows)
    .map(mapContractRow)
    .filter((row): row is SorobanFeeContractRank => row !== null)
    .sort(
      (left, right) =>
        right.totalFeeStroops - left.totalFeeStroops ||
        right.invokeCount - left.invokeCount ||
        left.contractId.localeCompare(right.contractId),
    )
    .slice(0, TOP_SOROBAN_FEE_CONTRACTS);

  return {
    totalFeeStroops,
    invokeCount,
    resourceStroops,
    avgResourceStroopsPerInvoke:
      invokeCount === 0 ? null : resourceStroops / invokeCount,
    topContracts,
  };
}
