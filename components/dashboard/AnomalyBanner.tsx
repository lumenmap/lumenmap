"use client";

import { useEffect, useState } from "react";
import type { Anomaly } from "@/lib/anomalies";

const LABELS: Record<Anomaly["metric"], string> = {
  ops: "Operations",
  activeWallets: "Active wallets",
  sorobanShare: "Soroban share",
};

/**
 * Dismissible KPI anomaly banner. Escape or the Dismiss control hides it.
 * Nothing renders when there are no findings.
 */
export function AnomalyBanner({ findings }: { findings: Anomaly[] }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDismissed(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (dismissed || findings.length === 0) return null;

  return (
    <div
      role="status"
      data-testid="anomaly-banner"
      className="rounded-lg border border-amber-700/70 bg-amber-950/50 px-4 py-3 text-sm text-amber-50"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">Notable change versus the previous period</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
            {findings.map((finding) => (
              <li key={finding.metric}>
                {LABELS[finding.metric]} {finding.direction}:{" "}
                {finding.absolute > 0 ? "+" : ""}
                {finding.absolute}
                {finding.percent === null ? "" : ` (${finding.percent.toFixed(0)}%)`}
                {" · "}
                <a className="underline" href={finding.inspectHref}>
                  Inspect
                </a>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="self-start rounded border border-amber-400/40 px-2 py-1 text-xs"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
