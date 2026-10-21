"use client";

import { useMemo } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { FlowEgoView } from "@/components/dashboard/FlowEgoView";
import { buildEgoGraph } from "@/lib/flow-ego";

/**
 * Flow ego section (issue #311).
 *
 * Renders when the Flow feature flag is on and the chart view is Flow.
 * The ego account comes from the watchlist (`egoAddress`) or the current
 * selection. With no account selected, a prompt replaces the graph.
 *
 * Edge data has no live source yet (Flow MVP #287), so counterparties come
 * from an empty set until the activity API exposes per-account payments —
 * the populated path is covered by unit tests against fixture edges.
 */
export function FlowEgoSection() {
  const { chartView, flowViewEnabled, selectedNode, egoAddress } = useDashboard();
  const flowActive = flowViewEnabled && chartView === "flow";

  const account = useMemo(() => {
    if (!flowActive) return null;
    if (egoAddress) {
      const label =
        selectedNode?.meta?.id === egoAddress ? selectedNode.name : egoAddress;
      return { id: egoAddress, label };
    }
    if (!selectedNode?.meta?.id) return null;
    return { id: selectedNode.meta.id, label: selectedNode.name };
  }, [flowActive, egoAddress, selectedNode]);

  if (!flowActive) return null;

  if (!account) {
    return (
      <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <p className="text-sm font-semibold text-white">Flow ego view</p>
        <p className="mt-1 text-sm text-zinc-400">
          Search for an account or contract above to open its ego graph.
        </p>
      </div>
    );
  }

  const graph = buildEgoGraph(account.id, account.label, [], []);

  return (
    <div className="mb-6">
      <FlowEgoView accountId={graph.centerId} accountLabel={graph.centerLabel} graph={graph} />
    </div>
  );
}
