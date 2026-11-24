/**
 * In-process rolling window of BigQuery bytes billed from activity queries.
 * Used by structured logs and readiness health — never stores project/table IDs.
 */

import {
  recordDailyBytesBilled,
  resetDailyBytesBudget,
} from "@/lib/hubble/bytes-budget";

export type BytesBilledSample = {
  atMs: number;
  bytes: number;
};

const samples: BytesBilledSample[] = [];

const DEFAULT_WINDOW_MINUTES = 15;
/** Default degraded threshold: 10 × default max-bytes-billed (1 GB) = 10 GB. */
const DEFAULT_DEGRADED_THRESHOLD = 10 * 1_073_741_824;

export function resetBytesBilledTelemetry(): void {
  samples.length = 0;
  resetDailyBytesBudget();
}

export function recordBytesBilled(bytes: number, atMs = Date.now()): void {
  const value = Number.isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
  samples.push({ atMs, bytes: value });
  pruneOlderThan(atMs - getBytesBilledWindowMs());
  recordDailyBytesBilled(value, atMs);
}

function pruneOlderThan(cutoffMs: number): void {
  while (samples.length > 0 && samples[0]!.atMs < cutoffMs) {
    samples.shift();
  }
}

export function getBytesBilledWindowMinutes(): number {
  const raw = process.env.BIGQUERY_BYTES_BILLED_WINDOW_MINUTES;
  if (raw === undefined || raw === "") return DEFAULT_WINDOW_MINUTES;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 24 * 60) {
    return DEFAULT_WINDOW_MINUTES;
  }
  return value;
}

export function getBytesBilledWindowMs(): number {
  return getBytesBilledWindowMinutes() * 60_000;
}

export function getBytesBilledDegradedThreshold(): number {
  const raw = process.env.BIGQUERY_BYTES_BILLED_DEGRADED_THRESHOLD;
  if (raw === undefined || raw === "") return DEFAULT_DEGRADED_THRESHOLD;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return DEFAULT_DEGRADED_THRESHOLD;
  }
  return value;
}

/** Aggregate bytes billed inside the configured rolling window. */
export function getRollingBytesBilled(nowMs = Date.now()): number {
  const cutoff = nowMs - getBytesBilledWindowMs();
  pruneOlderThan(cutoff);
  return samples.reduce((sum, sample) => sum + sample.bytes, 0);
}

export function extractTotalBytesBilled(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const stats = (metadata as { statistics?: { query?: { totalBytesBilled?: unknown } } })
    .statistics?.query?.totalBytesBilled;
  if (typeof stats === "number" && Number.isFinite(stats)) {
    return Math.max(0, Math.floor(stats));
  }
  if (typeof stats === "string" && /^\d+$/.test(stats)) {
    return Number(stats);
  }
  return 0;
}
