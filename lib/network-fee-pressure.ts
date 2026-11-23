import { getBigQueryClient } from "@/lib/hubble/client";
import { getMaxBytesBilledLimit } from "@/lib/hubble/config";
import { isFixtureMode } from "@/lib/data-source";
import { resolvePeriod } from "@/lib/periods";
import type { Period } from "@/lib/types";

export type FeePoint = { timestamp: string; stroops: number };
export type FeePressure = {
  period: Period;
  granularity: "hour" | "day";
  classic: FeePoint[] | null;
  soroban: FeePoint[] | null;
  source: "hubble" | "fixture";
};

export const classicFeePressureQuery = (granularity: "HOUR" | "DAY") => `
SELECT TIMESTAMP_TRUNC(closed_at, ${granularity}) AS bucket_time,
  APPROX_QUANTILES(SAFE_DIVIDE(fee_charged, operation_count), 100)[OFFSET(95)] AS fee_stroops
FROM \`crypto-stellar.crypto_stellar.history_transactions\`
WHERE @start <= closed_at AND closed_at < @end
  AND batch_run_date >= DATETIME_SUB(DATETIME(@start), INTERVAL 1 DAY)
  AND batch_run_date < DATETIME_ADD(DATETIME(@end), INTERVAL 1 DAY)
  AND COALESCE(resource_fee, 0) = 0 AND operation_count > 0 AND fee_charged >= 0
GROUP BY bucket_time ORDER BY bucket_time`;

export const sorobanResourcePressureQuery = (granularity: "HOUR" | "DAY") => `
SELECT TIMESTAMP_TRUNC(hour_agg, ${granularity}) AS bucket_time,
  SAFE_DIVIDE(SUM(total_non_refundable_resource_fee), SUM(txn_count)) AS fee_stroops
FROM \`crypto-stellar.crypto_stellar_dbt.hourly_soroban_fee_agg_contract\`
WHERE @start <= hour_agg AND hour_agg < @end
GROUP BY bucket_time ORDER BY bucket_time`;

export function mapFeePressureRows(rows: unknown): FeePoint[] {
  if (!Array.isArray(rows)) return [];
  const points = new Map<string, number>();
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const rawTime = row.bucket_time;
    const raw = rawTime && typeof rawTime === "object" && "value" in rawTime
      ? (rawTime as { value: unknown }).value : rawTime;
    const time = raw instanceof Date ? raw
      : typeof raw === "string" || typeof raw === "number" ? new Date(raw) : null;
    if (!time || !Number.isFinite(time.getTime()) || row.fee_stroops == null) continue;
    const rawFee = typeof row.fee_stroops === "object" && row.fee_stroops !== null && "value" in row.fee_stroops
      ? (row.fee_stroops as { value: unknown }).value : row.fee_stroops;
    const value = typeof rawFee === "string" || typeof rawFee === "number" || typeof rawFee === "bigint"
      ? Number(rawFee) : Number.NaN;
    if (!Number.isFinite(value) || value < 0) continue;
    points.set(time.toISOString(), value);
  }
  return [...points].sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, stroops]) => ({ timestamp, stroops }));
}

export type FeeQueryRunner = (
  sql: string,
  params: { start: string; end: string },
) => Promise<unknown>;

async function runLiveQuery(sql: string, params: { start: string; end: string }) {
  const client = getBigQueryClient();
  if (!client) throw new Error("BigQuery client is not configured");
  const [job] = await client.createQueryJob({
    query: sql, params, maximumBytesBilled: getMaxBytesBilledLimit().toString(),
  });
  const [rows] = await job.getQueryResults();
  return rows;
}

export async function loadFeePressure(input: {
  period: Period;
  network?: "mainnet" | "testnet";
  now?: Date;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  runQuery?: FeeQueryRunner;
}): Promise<FeePressure> {
  const granularity: "hour" | "day" = input.period === "1d" ? "hour" : "day";
  const base = { period: input.period, granularity };
  try {
    if (isFixtureMode(input.env)) {
      const now = input.now ?? new Date();
      const { start, end } = resolvePeriod(input.period, now);
      const step = granularity === "hour" ? 3_600_000 : 86_400_000;
      const points = Array.from({ length: Math.floor((Math.min(end.getTime(), now.getTime()) - start.getTime()) / step) + 1 }, (_, i) =>
        new Date(start.getTime() + i * step).toISOString());
      return {
        ...base, source: "fixture",
        classic: points.map((timestamp, i) => ({ timestamp, stroops: 100 + (i % 5) * 25 + (i === 14 ? 175 : 0) })),
        soroban: points.map((timestamp, i) => ({ timestamp, stroops: 18_000 + (i % 4) * 2_000 + (i === 14 ? 10_000 : 0) })),
      };
    }
  } catch {
    return { ...base, source: "hubble", classic: null, soroban: null };
  }
  if (input.network === "testnet") return { ...base, source: "hubble", classic: null, soroban: null };
  const { start, end } = resolvePeriod(input.period, input.now);
  const params = { start: start.toISOString(), end: end.toISOString() };
  const datePart = granularity === "hour" ? "HOUR" : "DAY";
  const run = input.runQuery ?? runLiveQuery;
  const [classic, soroban] = await Promise.allSettled([
    run(classicFeePressureQuery(datePart), params), run(sorobanResourcePressureQuery(datePart), params),
  ]);
  return {
    ...base, source: "hubble",
    classic: classic.status === "fulfilled" ? mapFeePressureRows(classic.value) : null,
    soroban: soroban.status === "fulfilled" ? mapFeePressureRows(soroban.value) : null,
  };
}
