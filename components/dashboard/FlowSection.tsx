// FlowSection.tsx
"use client";

import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { FlowDataTable } from "@/components/dashboard/FlowDataTable";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { FreshnessWarning } from "@/components/dashboard/FreshnessWarning";
import { SavedViewsControls } from "@/components/dashboard/SavedViewsControls";
import { isMetricSupportedOnNetwork, unsupportedMetricMessage } from "@/lib/network";
import type { FlowNode, FlowEdge } from "@/lib/types";

export function FlowSection() {
  const { metric, network, setMetric, data } = useDashboard();
  const metricSupported = isMetricSupportedOnNetwork(metric, network);

  // The dashboard API includes flow data within the generic `data` object when the metric is relevant.
  // For simplicity, we fallback to empty arrays if not present.
  const nodes = (data?.flow?.nodes as readonly FlowNode[]) ?? [];
  const edges = (data?.flow?.edges as readonly FlowEdge[]) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-8">
      <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <FreshnessIndicator />
        <p className="text-xs text-zinc-500">
          <a href="/methodology" className="text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm">
            Metric methodology
          </a>{" · "}definitions on each KPI
        </p>
      </header>

      <FreshnessWarning />
      <SavedViewsControls />

      {!metricSupported && (
        <div role="status" className="rounded-lg border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          <p>{unsupportedMetricMessage(metric)}</p>
          <button type="button" className="mt-2 text-sm font-medium text-amber-50 underline" onClick={() => setMetric("ops")}>Switch to operations</button>
        </div>
      )}

      <FlowDataTable nodes={nodes} edges={edges} />
    </div>
  );
}
