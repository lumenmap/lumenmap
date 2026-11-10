import { classifyError } from "@/lib/log";
import { mapFeeNumber } from "@/lib/soroban-fees/mapper";
import type { Period } from "@/lib/types";

export const FEE_PRESSURE_FIXTURE_CLASSIC_TOTAL_STROOPS = 420_000_000;
export const FEE_PRESSURE_FIXTURE_SOROBAN_RESOURCE_TOTAL_STROOPS = 900_000_000;

export type FeePressureUnavailableReason =
  | "schema_drift"
  | "query_failed"
  | "both_unavailable";

export interface FeePressurePoint {
  bucketStart: string;
  classicFeeStroops: number | null;
  sorobanResourceFeeStroops: number | null;
  opCount: number;
}

export interface NetworkFeePressureSummary {
  status: "available" | "unavailable";
  source: "hubble" | "fixture";
  period: Period;
  unit: "stroops";
  classicAvailable: boolean;
  sorobanAvailable: boolean;
  totalClassicFeeStroops: number | null;
  totalSorobanResourceFeeStroops: number | null;
  peakFeeStroops: number | null;
  peakOpCount: number;
  /**
   * Light correlation (Pearson r in [-1, 1]) between combined bucket fees
   * (classic + Soroban resource stroops) and operation count across the period.
   */
  opFeeCorrelation: number | null;
  points: FeePressurePoint[];
  reason?: FeePressureUnavailableReason;
  message?: string;
  methodologySectionId: "soroban-fees";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function mapNullableFeeNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return mapFeeNumber(value);
}

/**
 * Compute Pearson correlation coefficient r in [-1, 1] between two series.
 * Returns null when fewer than 2 points or either series has zero variance.
 */
export function computeSeriesCorrelation(
  xs: readonly number[],
  ys: readonly number[],
): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;

  const meanX = xs.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
  const meanY = ys.slice(0, n).reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(4));
}

export function unavailableFeePressure(input: {
  period: Period;
  source?: "hubble" | "fixture";
  error?: unknown;
  reason?: FeePressureUnavailableReason;
}): NetworkFeePressureSummary {
  const reason: FeePressureUnavailableReason =
    input.reason ??
    (classifyError(input.error) === "schema" ? "schema_drift" : "query_failed");
  const message =
    reason === "schema_drift"
      ? "Classic and Soroban fee pressure columns are not available in the current Hubble schema."
      : reason === "both_unavailable"
        ? "Both classic fee and Soroban resource fee series are unavailable for this period."
        : "Network fee pressure could not be loaded for this period.";

  return {
    status: "unavailable",
    source: input.source ?? "hubble",
    period: input.period,
    unit: "stroops",
    classicAvailable: false,
    sorobanAvailable: false,
    totalClassicFeeStroops: null,
    totalSorobanResourceFeeStroops: null,
    peakFeeStroops: null,
    peakOpCount: 0,
    opFeeCorrelation: null,
    points: [],
    reason,
    message,
    methodologySectionId: "soroban-fees",
  };
}

export function mapFeePressureRows(input: {
  period: Period;
  source?: "hubble" | "fixture";
  rows: unknown;
  classicAvailable?: boolean;
  sorobanAvailable?: boolean;
}): NetworkFeePressureSummary {
  const rawList = Array.isArray(input.rows) ? input.rows : [];
  const points: FeePressurePoint[] = [];

  for (const item of rawList) {
    const row = asRecord(item);
    if (!row) continue;
    const bucketStart =
      typeof row.bucket_start === "string" ? row.bucket_start.trim() : "";
    if (!bucketStart) continue;

    const classicRaw = mapNullableFeeNumber(row.classic_fee_stroops);
    const sorobanRaw = mapNullableFeeNumber(row.soroban_resource_fee_stroops);
    const opCount = mapFeeNumber(row.op_count);

    points.push({
      bucketStart,
      classicFeeStroops: input.classicAvailable === false ? null : classicRaw,
      sorobanResourceFeeStroops:
        input.sorobanAvailable === false ? null : sorobanRaw,
      opCount,
    });
  }

  const hasClassic =
    input.classicAvailable !== false &&
    points.some((p) => p.classicFeeStroops !== null);
  const hasSoroban =
    input.sorobanAvailable !== false &&
    points.some((p) => p.sorobanResourceFeeStroops !== null);

  if (!hasClassic && !hasSoroban) {
    return unavailableFeePressure({
      period: input.period,
      source: input.source ?? "hubble",
      reason: "both_unavailable",
    });
  }

  const totalClassicFeeStroops = hasClassic
    ? points.reduce((sum, p) => sum + (p.classicFeeStroops ?? 0), 0)
    : null;
  const totalSorobanResourceFeeStroops = hasSoroban
    ? points.reduce((sum, p) => sum + (p.sorobanResourceFeeStroops ?? 0), 0)
    : null;

  const combinedFees = points.map(
    (p) => (p.classicFeeStroops ?? 0) + (p.sorobanResourceFeeStroops ?? 0),
  );
  const opCounts = points.map((p) => p.opCount);

  const peakFeeStroops =
    combinedFees.length > 0 ? Math.max(...combinedFees) : 0;
  const peakOpCount = opCounts.length > 0 ? Math.max(...opCounts) : 0;
  const opFeeCorrelation = computeSeriesCorrelation(combinedFees, opCounts);

  return {
    status: "available",
    source: input.source ?? "hubble",
    period: input.period,
    unit: "stroops",
    classicAvailable: hasClassic,
    sorobanAvailable: hasSoroban,
    totalClassicFeeStroops,
    totalSorobanResourceFeeStroops,
    peakFeeStroops,
    peakOpCount,
    opFeeCorrelation,
    points,
    methodologySectionId: "soroban-fees",
  };
}

export function buildFeePressureFixture(period: Period): NetworkFeePressureSummary {
  // Classic total: 80M + 110M + 140M + 90M = 420,000,000 stroops
  // Soroban resource total: 180M + 240M + 300M + 180M = 900,000,000 stroops
  const rows = [
    {
      bucket_start: "2026-01-01T00:00:00.000Z",
      classic_fee_stroops: 80_000_000,
      soroban_resource_fee_stroops: 180_000_000,
      op_count: 11_000,
    },
    {
      bucket_start: "2026-01-01T06:00:00.000Z",
      classic_fee_stroops: 110_000_000,
      soroban_resource_fee_stroops: 240_000_000,
      op_count: 14_500,
    },
    {
      bucket_start: "2026-01-01T12:00:00.000Z",
      classic_fee_stroops: 140_000_000,
      soroban_resource_fee_stroops: 300_000_000,
      op_count: 18_500,
    },
    {
      bucket_start: "2026-01-01T18:00:00.000Z",
      classic_fee_stroops: 90_000_000,
      soroban_resource_fee_stroops: 180_000_000,
      op_count: 12_000,
    },
  ];

  return mapFeePressureRows({
    period,
    source: "fixture",
    rows,
    classicAvailable: true,
    sorobanAvailable: true,
  });
}
