"use client";

import { useMemo } from "react";
import type {
  FlowTableEdge,
  FlowTableNode,
} from "@/components/dashboard/FlowDataTable";
import {
  buildSankeyModel,
  DEFAULT_SANKEY_TOP_N,
} from "@/lib/hubble/sankey-flow";
import { cn } from "@/lib/utils";

export interface FlowSankeyProps {
  nodes: readonly FlowTableNode[];
  edges: readonly FlowTableEdge[];
  topN?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  staticLayout?: boolean;
}

export function FlowSankey({
  nodes,
  edges,
  topN = DEFAULT_SANKEY_TOP_N,
  selectedId,
  onSelect,
  staticLayout = false,
}: FlowSankeyProps) {
  const model = useMemo(
    () => buildSankeyModel(nodes, edges, { topN }),
    [nodes, edges, topN],
  );

  if (model.bands.length === 0) {
    return (
      <div
        role="status"
        data-testid="flow-sankey-empty"
        className="rounded-xl border border-white/10 bg-black/20 p-6 text-center text-sm text-zinc-400"
      >
        No XLM or USDC payment flows available for the selected period.
      </div>
    );
  }

  return (
    <div
      data-testid="flow-sankey"
      data-layout-mode={staticLayout ? "static" : "responsive"}
      className="max-w-full space-y-4 rounded-xl border border-white/10 bg-canvas p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span
          data-testid="sankey-cap-badge"
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-zinc-300"
        >
          {model.capBadgeText}
        </span>
        <span
          data-testid="sankey-coverage-badge"
          className="rounded-full border border-stellar-light/30 bg-stellar-light/10 px-2.5 py-1 font-mono text-stellar-light"
        >
          {model.coverageBadgeText}
        </span>
      </div>

      <div className="max-w-full overflow-x-auto">
        <ul
          aria-label="Ranked payment flows (source to asset to destination)"
          className="min-w-[22rem] space-y-2"
        >
          {model.bands.map((band, index) => {
            const isSelected =
              selectedId === band.id ||
              selectedId === band.sourceId ||
              selectedId === band.destinationId;
            return (
              <li key={band.id}>
                <button
                  type="button"
                  data-testid="sankey-flow-row"
                  aria-pressed={isSelected}
                  onClick={() => onSelect?.(band.sourceId)}
                  className={cn(
                    "w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light motion-reduce:transition-none",
                    !staticLayout && "transition-colors",
                    isSelected && "border-stellar-light bg-white/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-200">
                    <span className="truncate font-medium">
                      #{index + 1} {band.sourceLabel} →{" "}
                      <span className="font-mono text-stellar-light">
                        {band.assetCode}
                      </span>{" "}
                      → {band.destinationLabel}
                    </span>
                    <span className="shrink-0 font-mono text-zinc-400">
                      {band.operationCount.toLocaleString("en-US")} ops
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-stellar-light motion-reduce:transition-none"
                      style={{ width: `${band.widthPercent}%` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
