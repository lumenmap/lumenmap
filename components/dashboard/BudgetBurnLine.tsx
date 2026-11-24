"use client";

import { useEffect, useState } from "react";

type BudgetPayload = {
  dailyBudgetBytes: number;
  dailyUsedBytes: number;
  dailyRemainingBytes: number;
  dailyBudgetStatus: "ok" | "soft_warn" | "over";
};

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  return `${bytes} B`;
}

/**
 * Operator-facing daily BigQuery burn line sourced from readiness health.
 * Soft warnings stay visible; core activity is not blocked by this component.
 */
export function BudgetBurnLine() {
  const [budget, setBudget] = useState<BudgetPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/health?type=readiness", {
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const body = (await response.json()) as {
          checks?: { bytesBilled?: BudgetPayload };
        };
        const next = body.checks?.bytesBilled;
        if (
          next &&
          typeof next.dailyBudgetBytes === "number" &&
          typeof next.dailyUsedBytes === "number"
        ) {
          if (!cancelled) setBudget(next);
        }
      } catch {
        // Health is optional for the dashboard chrome.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!budget || budget.dailyBudgetBytes <= 0) return null;

  const ratio = Math.min(1, budget.dailyUsedBytes / budget.dailyBudgetBytes);
  const percent = Math.round(ratio * 100);
  const tone =
    budget.dailyBudgetStatus === "over"
      ? "bg-red-500"
      : budget.dailyBudgetStatus === "soft_warn"
        ? "bg-amber-400"
        : "bg-emerald-500";

  return (
    <div
      role="status"
      aria-label="Daily BigQuery bytes budget"
      className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-zinc-400">
        <span>Daily BigQuery burn</span>
        <span>
          {formatBytes(budget.dailyUsedBytes)} /{" "}
          {formatBytes(budget.dailyBudgetBytes)} ({percent}%) ·{" "}
          {formatBytes(budget.dailyRemainingBytes)} left
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full ${tone}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
