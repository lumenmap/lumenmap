/**
 * In-process rolling window of BigQuery bytes billed from activity queries,
 * plus 24-hour daily cost budget guardrail and burn telemetry (#461).
 * Used by structured logs and readiness health — never stores project/table IDs.
 */

export type BytesBilledSample = {
  atMs: number;
  bytes: number;
};

export type DailyBudgetSnapshot = {
  dailyBytesUsed: number;
  dailyBytesBudget: number;
  dailyBytesRemaining: number;
  dailyBurnRatio: number;
  softThresholdBytes: number;
  softThresholdExceeded: boolean;
  budgetExceeded: boolean;
  hardFailNonCriticalActive: boolean;
};

const samples: BytesBilledSample[] = [];

const DEFAULT_WINDOW_MINUTES = 15;
const DAY_IN_MS = 24 * 60 * 60_000;
const GIB_IN_BYTES = 1_073_741_824;

/** Default degraded threshold: 10 × default max-bytes-billed (1 GB) = 10 GB. */
const DEFAULT_DEGRADED_THRESHOLD = 10 * GIB_IN_BYTES;

/** Default 24h daily budget: 100 GiB. */
const DEFAULT_DAILY_BYTES_BUDGET = 100 * GIB_IN_BYTES;

/** Default soft warning ratio of the daily budget (80%). */
const DEFAULT_DAILY_SOFT_RATIO = 0.8;

export function resetBytesBilledTelemetry(): void {
  samples.length = 0;
}

export function recordBytesBilled(bytes: number, atMs = Date.now()): void {
  const value = Number.isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
  samples.push({ atMs, bytes: value });
  const retentionMs = Math.max(getBytesBilledWindowMs(), DAY_IN_MS);
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

export function getDailyBytesBudget(): number {
  const raw = process.env.BIGQUERY_DAILY_BYTES_BUDGET;
  if (raw === undefined || raw === "") return DEFAULT_DAILY_BYTES_BUDGET;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return DEFAULT_DAILY_BYTES_BUDGET;
  }
  return value;
}

export function getDailyBudgetSoftRatio(): number {
  const raw = process.env.BIGQUERY_DAILY_BUDGET_SOFT_RATIO;
  if (raw === undefined || raw === "") return DEFAULT_DAILY_SOFT_RATIO;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    return DEFAULT_DAILY_SOFT_RATIO;
  }
  return value;
}

export function isHardFailNonCriticalEnabled(): boolean {
  const raw = (
    process.env.BIGQUERY_DAILY_BUDGET_HARD_FAIL_NON_CRITICAL ?? ""
  )
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1";
}

/** Aggregate bytes billed inside the configured rolling window. */
export function getRollingBytesBilled(nowMs = Date.now()): number {
  const cutoff = nowMs - getBytesBilledWindowMs();
  pruneOlderThan(nowMs - Math.max(getBytesBilledWindowMs(), DAY_IN_MS));
  return samples.reduce(
    (sum, sample) => (sample.atMs >= cutoff ? sum + sample.bytes : sum),
    0,
  );
}

/** Aggregate bytes billed inside the last 24 hours. */
export function getDailyBytesBilled(nowMs = Date.now()): number {
  const cutoff = nowMs - DAY_IN_MS;
  pruneOlderThan(nowMs - Math.max(getBytesBilledWindowMs(), DAY_IN_MS));
  return samples.reduce(
    (sum, sample) => (sample.atMs >= cutoff ? sum + sample.bytes : sum),
    0,
  );
}

/**
 * Compute daily budget consumption, remaining bytes, soft-warning state, and
 * whether optional hard-fail for non-critical queries is active.
 */
export function getDailyBudgetSnapshot(
  nowMs = Date.now(),
  options?: { fixtureMode?: boolean; simulatedBytesUsed?: number },
): DailyBudgetSnapshot {
  const dailyBytesBudget = getDailyBytesBudget();
  const softRatio = getDailyBudgetSoftRatio();
  const softThresholdBytes = Math.floor(dailyBytesBudget * softRatio);
  const dailyBytesUsed = options?.fixtureMode
    ? Math.max(0, Math.floor(options.simulatedBytesUsed ?? 0))
    : options?.simulatedBytesUsed !== undefined
      ? Math.max(0, Math.floor(options.simulatedBytesUsed))
      : getDailyBytesBilled(nowMs);
  const dailyBytesRemaining = Math.max(0, dailyBytesBudget - dailyBytesUsed);
  const dailyBurnRatio = Number(
    (dailyBytesUsed / dailyBytesBudget).toFixed(4),
  );
  const softThresholdExceeded = dailyBytesUsed >= softThresholdBytes;
  const budgetExceeded = dailyBytesUsed >= dailyBytesBudget;
  const hardFailNonCriticalActive =
    !options?.fixtureMode &&
    budgetExceeded &&
    isHardFailNonCriticalEnabled();

  return {
    dailyBytesUsed,
    dailyBytesBudget,
    dailyBytesRemaining,
    dailyBurnRatio,
    softThresholdBytes,
    softThresholdExceeded,
    budgetExceeded,
    hardFailNonCriticalActive,
  };
}

/**
 * Returns true only when the daily budget is exhausted AND the operator has
 * explicitly enabled `BIGQUERY_DAILY_BUDGET_HARD_FAIL_NON_CRITICAL=true`.
 * Core activity queries are never blocked by default.
 */
export function shouldBlockNonCriticalQuery(nowMs = Date.now()): boolean {
  return getDailyBudgetSnapshot(nowMs).hardFailNonCriticalActive;
}

export function formatBytesCompact(bytes: number): string {
  if (bytes >= GIB_IN_BYTES) {
    return `${(bytes / GIB_IN_BYTES).toFixed(2)} GiB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(2)} MiB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${bytes} B`;
}

export function formatDailyBurnLine(snapshot: DailyBudgetSnapshot): string {
  const pct = (snapshot.dailyBurnRatio * 100).toFixed(1);
  const stateLabel = snapshot.budgetExceeded
    ? "BUDGET EXCEEDED"
    : snapshot.softThresholdExceeded
      ? "SOFT WARNING"
      : "OK";
  return `Daily BigQuery burn [${stateLabel}]: ${formatBytesCompact(snapshot.dailyBytesUsed)} / ${formatBytesCompact(snapshot.dailyBytesBudget)} (${pct}% used · ${formatBytesCompact(snapshot.dailyBytesRemaining)} remaining)`;
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
