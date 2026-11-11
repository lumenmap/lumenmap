/**
 * In-process rolling and 24h daily window of BigQuery bytes billed from activity queries.
 * Used by structured logs, daily cost budget guardrails, and readiness health —
 * never stores project/table IDs.
 */

export type BytesBilledSample = {
  atMs: number;
  bytes: number;
};

export type DailyBurnSummary = {
  dailyBytesBilled: number;
  dailyBytesRemaining: number;
  dailyBytesBudget: number;
  utilizationPercent: number;
  softWarnPercent: number;
  estimatedUsdBurn: number;
  isSoftWarning: boolean;
  isExceeded: boolean;
  formattedLine: string;
};

export type BudgetGuardrailDecision = {
  shouldHardFail: boolean;
  shouldWarn: boolean;
  summary: DailyBurnSummary;
};

const samples: BytesBilledSample[] = [];

const DEFAULT_WINDOW_MINUTES = 15;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const BYTES_PER_GIB = 1_073_741_824;
const BYTES_PER_TIB = 1_099_511_627_776;
const BIGQUERY_USD_PER_TIB = 6.25;

/** Default degraded threshold: 10 × default max-bytes-billed (1 GB) = 10 GB. */
const DEFAULT_DEGRADED_THRESHOLD = 10 * BYTES_PER_GIB;
/** Default 24-hour daily budget: 50 GB. */
const DEFAULT_DAILY_BYTES_BUDGET = 50 * BYTES_PER_GIB;
/** Default soft warning threshold: 80% of daily bytes budget. */
const DEFAULT_DAILY_SOFT_WARN_PERCENT = 80;

export function resetBytesBilledTelemetry(): void {
  samples.length = 0;
}

export function recordBytesBilled(bytes: number, atMs = Date.now()): void {
  const value = Number.isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
  samples.push({ atMs, bytes: value });
  const retentionMs = Math.max(getBytesBilledWindowMs(), DAY_WINDOW_MS);
  pruneOlderThan(atMs - retentionMs);
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

export function getDailyBytesBudgetLimit(): number {
  const raw = process.env.BIGQUERY_DAILY_BYTES_BUDGET;
  if (raw === undefined || raw === "") return DEFAULT_DAILY_BYTES_BUDGET;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    return DEFAULT_DAILY_BYTES_BUDGET;
  }
  return value;
}

export function getDailyBytesSoftWarnPercent(): number {
  const raw = process.env.BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT;
  if (raw === undefined || raw === "") return DEFAULT_DAILY_SOFT_WARN_PERCENT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    return DEFAULT_DAILY_SOFT_WARN_PERCENT;
  }
  return value;
}

export function isDailyBytesBudgetHardFailEnabled(): boolean {
  const raw = process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/** Aggregate bytes billed inside the configured rolling window. */
export function getRollingBytesBilled(nowMs = Date.now()): number {
  const retentionMs = Math.max(getBytesBilledWindowMs(), DAY_WINDOW_MS);
  pruneOlderThan(nowMs - retentionMs);
  const cutoff = nowMs - getBytesBilledWindowMs();
  return samples.reduce(
    (sum, sample) => (sample.atMs >= cutoff ? sum + sample.bytes : sum),
    0,
  );
}

/** Aggregate bytes billed over the trailing 24-hour window. */
export function getDailyBytesBilled(nowMs = Date.now()): number {
  const retentionMs = Math.max(getBytesBilledWindowMs(), DAY_WINDOW_MS);
  pruneOlderThan(nowMs - retentionMs);
  const cutoff = nowMs - DAY_WINDOW_MS;
  return samples.reduce(
    (sum, sample) => (sample.atMs >= cutoff ? sum + sample.bytes : sum),
    0,
  );
}

/** True when trailing 24h bytes billed reaches or exceeds the daily budget guardrail. */
export function isDailyBytesBudgetExceeded(nowMs = Date.now()): boolean {
  return getDailyBytesBilled(nowMs) >= getDailyBytesBudgetLimit();
}

export function formatDailyBurnLine(
  dailyBytesBilled: number,
  dailyBytesBudget = getDailyBytesBudgetLimit(),
): string {
  const safeBytes = Math.max(0, dailyBytesBilled);
  const safeBudget = Math.max(1, dailyBytesBudget);
  const billedGb = (safeBytes / BYTES_PER_GIB).toFixed(2);
  const budgetGb = (safeBudget / BYTES_PER_GIB).toFixed(2);
  const pct = ((safeBytes / safeBudget) * 100).toFixed(1);
  const usd = ((safeBytes / BYTES_PER_TIB) * BIGQUERY_USD_PER_TIB).toFixed(2);
  return `Daily BigQuery burn: ${billedGb} GB / ${budgetGb} GB (${pct}% · ~$${usd})`;
}

export function getDailyBurnSummary(nowMs = Date.now()): DailyBurnSummary {
  const dailyBytesBilled = getDailyBytesBilled(nowMs);
  const dailyBytesBudget = getDailyBytesBudgetLimit();
  const dailyBytesRemaining = Math.max(0, dailyBytesBudget - dailyBytesBilled);
  const softWarnPercent = getDailyBytesSoftWarnPercent();
  const rawRatio = (dailyBytesBilled / Math.max(1, dailyBytesBudget)) * 100;
  const utilizationPercent = Number(rawRatio.toFixed(2));
  const estimatedUsdBurn = Number(
    ((dailyBytesBilled / BYTES_PER_TIB) * BIGQUERY_USD_PER_TIB).toFixed(4),
  );
  const isExceeded = dailyBytesBilled >= dailyBytesBudget;
  const isSoftWarning = rawRatio >= softWarnPercent;

  return {
    dailyBytesBilled,
    dailyBytesRemaining,
    dailyBytesBudget,
    utilizationPercent,
    softWarnPercent,
    estimatedUsdBurn,
    isSoftWarning,
    isExceeded,
    formattedLine: formatDailyBurnLine(dailyBytesBilled, dailyBytesBudget),
  };
}

/**
 * Evaluates whether an incoming BigQuery job should emit a soft budget warning
 * or hard-fail. Core queries never hard-fail by default; optional non-critical
 * queries only hard-fail when `BIGQUERY_DAILY_BUDGET_HARD_FAIL=true` and the
 * 24h budget is exhausted.
 */
export function evaluateQueryBudgetGuardrail(options?: {
  nonCritical?: boolean;
  nowMs?: number;
}): BudgetGuardrailDecision {
  const summary = getDailyBurnSummary(options?.nowMs);
  const nonCritical = options?.nonCritical === true;
  const shouldHardFail =
    summary.isExceeded && nonCritical && isDailyBytesBudgetHardFailEnabled();
  const shouldWarn = summary.isSoftWarning || summary.isExceeded;

  return {
    shouldHardFail,
    shouldWarn,
    summary,
  };
}

export function extractTotalBytesBilled(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const stats = (
    metadata as { statistics?: { query?: { totalBytesBilled?: unknown } } }
  ).statistics?.query?.totalBytesBilled;
  if (typeof stats === "number" && Number.isFinite(stats)) {
    return Math.max(0, Math.floor(stats));
  }
  if (typeof stats === "string" && /^\d+$/.test(stats)) {
    return Number(stats);
  }
  return 0;
}
