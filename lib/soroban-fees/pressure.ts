import type { Period } from "@/lib/types";

export interface FeePressureBucket {
  timestamp: string;
  label: string;
  classicMedianFeeStroops: number | null;
  classicTotalFeeStroops: number | null;
  sorobanResourceFeeStroops: number | null;
  operations: number;
}

export interface FeePressureAnalytics {
  status: "available" | "unavailable";
  source: "hubble" | "fixture";
  period: Period;
  unit: "stroops";
  classicAvailable: boolean;
  sorobanAvailable: boolean;
  buckets: FeePressureBucket[];
  peakClassicMedianStroops: number | null;
  peakSorobanResourceStroops: number | null;
  methodologyHref: string;
  note: string;
}

export interface RawFeePressureRow {
  bucket_timestamp?: unknown;
  classic_median_fee_stroops?: unknown;
  classic_total_fee_stroops?: unknown;
  soroban_resource_fee_stroops?: unknown;
  op_count?: unknown;
}

function toFiniteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

export function mapFeePressureRows(
  rows: readonly RawFeePressureRow[],
  period: Period = "1d",
  source: "hubble" | "fixture" = "hubble",
): FeePressureAnalytics {
  const buckets: FeePressureBucket[] = [];
  let classicAvailable = false;
  let sorobanAvailable = false;
  let peakClassic: number | null = null;
  let peakSoroban: number | null = null;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const timestamp =
      typeof row.bucket_timestamp === "string" && row.bucket_timestamp.trim()
        ? row.bucket_timestamp.trim()
        : null;
    if (!timestamp) continue;

    const classicMedian = toFiniteNonNegative(row.classic_median_fee_stroops);
    const classicTotal = toFiniteNonNegative(row.classic_total_fee_stroops);
    const sorobanResource = toFiniteNonNegative(
      row.soroban_resource_fee_stroops,
    );
    const operations = toFiniteNonNegative(row.op_count) ?? 0;

    if (classicMedian !== null || classicTotal !== null) {
      classicAvailable = true;
    }
    if (sorobanResource !== null) {
      sorobanAvailable = true;
    }
    if (
      classicMedian !== null &&
      (peakClassic === null || classicMedian > peakClassic)
    ) {
      peakClassic = classicMedian;
    }
    if (
      sorobanResource !== null &&
      (peakSoroban === null || sorobanResource > peakSoroban)
    ) {
      peakSoroban = sorobanResource;
    }

    buckets.push({
      timestamp,
      label: timestamp.slice(11, 16) || timestamp.slice(0, 10),
      classicMedianFeeStroops: classicMedian,
      classicTotalFeeStroops: classicTotal,
      sorobanResourceFeeStroops: sorobanResource,
      operations,
    });
  }

  const anyAvailable = classicAvailable || sorobanAvailable;

  return {
    status: anyAvailable ? "available" : "unavailable",
    source,
    period,
    unit: "stroops",
    classicAvailable,
    sorobanAvailable,
    buckets: anyAvailable ? buckets : [],
    peakClassicMedianStroops: peakClassic,
    peakSorobanResourceStroops: peakSoroban,
    methodologyHref: "/methodology#network-fee-pressure",
    note: "Classic fee stats and non-refundable Soroban resource fees in stroops (1 XLM = 10,000,000 stroops), aligned with period operation counts.",
  };
}

export async function loadFeePressureAnalytics(
  period: Period,
  runner?: () => Promise<readonly RawFeePressureRow[]>,
): Promise<FeePressureAnalytics> {
  if (!runner) {
    return getFixtureFeePressureAnalytics(period);
  }
  try {
    const rows = await runner();
    return mapFeePressureRows(rows, period, "hubble");
  } catch {
    return {
      status: "unavailable",
      source: "hubble",
      period,
      unit: "stroops",
      classicAvailable: false,
      sorobanAvailable: false,
      buckets: [],
      peakClassicMedianStroops: null,
      peakSorobanResourceStroops: null,
      methodologyHref: "/methodology#network-fee-pressure",
      note: "Fee pressure series unavailable due to upstream schema drift or query failure.",
    };
  }
}

export function getFixtureFeePressureAnalytics(
  period: Period = "1d",
): FeePressureAnalytics {
  return mapFeePressureRows(
    [
      {
        bucket_timestamp: "2026-10-01T00:00:00Z",
        classic_median_fee_stroops: 100,
        classic_total_fee_stroops: 14_200_000,
        soroban_resource_fee_stroops: 89_500_000,
        op_count: 142_000,
      },
      {
        bucket_timestamp: "2026-10-01T06:00:00Z",
        classic_median_fee_stroops: 250,
        classic_total_fee_stroops: 38_500_000,
        soroban_resource_fee_stroops: 210_400_000,
        op_count: 198_400,
      },
      {
        bucket_timestamp: "2026-10-01T12:00:00Z",
        classic_median_fee_stroops: 120,
        classic_total_fee_stroops: 19_800_000,
        soroban_resource_fee_stroops: 115_000_000,
        op_count: 165_000,
      },
    ],
    period,
    "fixture",
  );
}
