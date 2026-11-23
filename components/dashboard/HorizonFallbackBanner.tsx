"use client";

import { useEffect, useState } from "react";
import type { HorizonFallbackReport } from "@/lib/horizon/fallback";

/**
 * The banner is not dismissible. A degraded read path that can be hidden
 * looks like the normal dashboard.
 */
export function HorizonFallbackBanner({ report }: { report: HorizonFallbackReport }) {
  if (!report.active) return null;
  const count =
    report.operationCount === null
      ? "Horizon did not return a usable operation count."
      : `Recent operation count estimate: ${report.operationCount}.`;
  return (
    <div
      role="status"
      data-testid="horizon-fallback-banner"
      className="rounded-lg border border-amber-700/70 bg-amber-950/50 px-4 py-3 text-sm text-amber-100"
    >
      <p className="font-semibold">Degraded · Horizon fallback</p>
      <p className="mt-1">{count}</p>
      <p className="mt-1 text-amber-200/80">
        This tile is Horizon only. Hubble numbers are not mixed into it.
      </p>
    </div>
  );
}

export function HorizonFallbackNotice() {
  const [report, setReport] = useState<HorizonFallbackReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((response) => response.json())
      .then((body: { fallback?: HorizonFallbackReport }) => {
        if (!cancelled) setReport(body.fallback ?? null);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!report) return null;
  return <HorizonFallbackBanner report={report} />;
}
