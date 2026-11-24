/**
 * Daily BigQuery bytes budget: soft warning in health, optional hard-fail for
 * non-critical queries. Counters are in-process only (same process as
 * bytes-billed telemetry).
 */

export type BudgetStatus = "ok" | "soft_warn" | "over";

export type DailyBudgetSnapshot = {
  dayKey: string;
  usedBytes: number;
  budgetBytes: number;
  remainingBytes: number;
  usedRatio: number;
  softThresholdRatio: number;
  status: BudgetStatus;
};

const dailySamples: { dayKey: string; bytes: number }[] = [];

/** Default daily budget: 50 × default max-bytes-billed (1 GB) = 50 GB. */
const DEFAULT_DAILY_BUDGET_BYTES = 50 * 1_073_741_824;
/** Soft warn when used ratio reaches this fraction of the budget. */
const DEFAULT_SOFT_THRESHOLD_RATIO = 0.8;

export function resetDailyBytesBudget(): void {
  dailySamples.length = 0;
}

export function utcDayKey(atMs = Date.now()): string {
  return new Date(atMs).toISOString().slice(0, 10);
}

export function recordDailyBytesBilled(bytes: number, atMs = Date.now()): void {
  const value = Number.isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
  dailySamples.push({ dayKey: utcDayKey(atMs), bytes: value });
}

function pruneOtherDays(keepDay: string): void {
  for (let i = dailySamples.length - 1; i >= 0; i -= 1) {
    if (dailySamples[i]!.dayKey !== keepDay) {
      dailySamples.splice(i, 1);
    }
  }
}

export function getDailyBytesBudget(): number {
  const raw = process.env.BIGQUERY_DAILY_BYTES_BUDGET;
  if (raw === undefined || raw === "") return DEFAULT_DAILY_BUDGET_BYTES;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) return DEFAULT_DAILY_BUDGET_BYTES;
  return value;
}

export function getDailyBudgetSoftThresholdRatio(): number {
  const raw = process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO;
  if (raw === undefined || raw === "") return DEFAULT_SOFT_THRESHOLD_RATIO;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    return DEFAULT_SOFT_THRESHOLD_RATIO;
  }
  return value;
}

/** When true, non-critical optional queries refuse to run once the budget is over. */
export function isDailyBudgetHardFailEnabled(): boolean {
  const raw = process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL;
  if (raw === undefined || raw === "") return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function getDailyBytesUsed(nowMs = Date.now()): number {
  const dayKey = utcDayKey(nowMs);
  pruneOtherDays(dayKey);
  return dailySamples.reduce((sum, sample) => sum + sample.bytes, 0);
}

export function getDailyBudgetSnapshot(nowMs = Date.now()): DailyBudgetSnapshot {
  const budgetBytes = getDailyBytesBudget();
  const usedBytes = getDailyBytesUsed(nowMs);
  const softThresholdRatio = getDailyBudgetSoftThresholdRatio();
  const remainingBytes = Math.max(0, budgetBytes - usedBytes);
  const usedRatio = budgetBytes === 0 ? (usedBytes > 0 ? 1 : 0) : usedBytes / budgetBytes;
  let status: BudgetStatus = "ok";
  if (usedBytes > budgetBytes) status = "over";
  else if (usedRatio >= softThresholdRatio) status = "soft_warn";
  return {
    dayKey: utcDayKey(nowMs),
    usedBytes,
    budgetBytes,
    remainingBytes,
    usedRatio,
    softThresholdRatio,
    status,
  };
}

/** True when optional non-critical work should be skipped. */
export function shouldHardFailNonCriticalQuery(nowMs = Date.now()): boolean {
  if (!isDailyBudgetHardFailEnabled()) return false;
  return getDailyBudgetSnapshot(nowMs).status === "over";
}
