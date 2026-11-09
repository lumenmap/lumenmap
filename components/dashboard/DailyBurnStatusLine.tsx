"use client";

import {
  formatDailyBurnLine,
  type DailyBudgetSnapshot,
} from "@/lib/hubble/bytes-billed-telemetry";

export interface DailyBurnStatusLineProps {
  snapshot: DailyBudgetSnapshot;
}

export function DailyBurnStatusLine({ snapshot }: DailyBurnStatusLineProps) {
  const toneClass = snapshot.budgetExceeded
    ? "border-amber-500/40 bg-amber-950/30 text-amber-200"
    : snapshot.softThresholdExceeded
      ? "border-yellow-500/40 bg-yellow-950/30 text-yellow-200"
      : "border-border bg-background/60 text-text-muted";

  return (
    <div
      role="status"
      aria-label="BigQuery daily cost budget burn"
      data-testid="daily-burn-status-line"
      className={`rounded-md border px-3 py-1.5 font-mono text-xs ${toneClass}`}
    >
      {formatDailyBurnLine(snapshot)}
    </div>
  );
}
