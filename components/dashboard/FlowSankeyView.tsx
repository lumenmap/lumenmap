"use client";

import { useMemo } from "react";
import type { FlowTableEdge, FlowTableNode } from "@/components/dashboard/FlowDataTable";
import {
  DEFAULT_SANKEY_TOP_N,
  buildSankeyModel,
} from "@/lib/flow/sankey";
import { formatExactNumber } from "@/lib/utils";

export function FlowSankeyView({
  nodes,
  edges,
  topN = DEFAULT_SANKEY_TOP_N,
  selectedId,
  onSelect,
}: {
  nodes: readonly FlowTableNode[];
  edges: readonly FlowTableEdge[];
  topN?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const model = useMemo(
    () => buildSankeyModel({ nodes, edges, topN }),
    [nodes, edges, topN],
  );

  if (model.links.length === 0) {
    return (
      <div
        data-testid="sankey-empty"
        className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-zinc-400"
      >
        No XLM or USDC payment flow edges available for the Sankey view.
      </div>
    );
  }

  const svgHeight = Math.max(
    260,
    Math.max(model.sources.length, model.destinations.length, 3) * 56 + 40,
  );

  return (
    <div
      data-testid="flow-sankey-view"
      className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/20 p-4 motion-reduce:transition-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-white">
            Top Payment Flows (Source → Asset → Destination)
          </h3>
          <p className="text-xs text-zinc-400">
            Restricted to XLM and USDC edges · Static reduced-motion compatible layout
          </p>
        </div>
        <span
          data-testid="sankey-coverage-badge"
          className="rounded-full border border-cyan-500/30 bg-cyan-950/50 px-3 py-1 font-mono text-xs text-cyan-200"
        >
          Top {model.coverage.returnedEdges} of {model.coverage.eligibleEdges} XLM/USDC edges ({model.coverage.coveragePercent}% ops · cap {model.coverage.topN})
        </span>
      </div>

      {/* Scrollable SVG region prevents horizontal page overflow on mobile */}
      <div className="w-full overflow-x-auto rounded-lg border border-white/5 bg-zinc-950/60 p-3">
        <svg
          viewBox={`0 0 720 ${svgHeight}`}
          className="min-w-[540px] w-full h-auto"
          role="img"
          aria-label="Sankey diagram of top XLM and USDC payment flows"
        >
          {model.links.map((link) => {
            const strokeColor =
              link.assetCode === "USDC" ? "#38bdf8" : "#a78bfa";
            return (
              <g key={link.id}>
                <path
                  d={`M 160 ${link.ySource} C 260 ${link.ySource}, 260 ${link.yAsset}, 360 ${link.yAsset}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeOpacity={0.55}
                  strokeWidth={link.thickness}
                />
                <path
                  d={`M 360 ${link.yAsset} C 460 ${link.yAsset}, 460 ${link.yDestination}, 560 ${link.yDestination}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeOpacity={0.55}
                  strokeWidth={link.thickness}
                />
              </g>
            );
          })}

          {model.sources.map((src) => (
            <g key={`src-${src.id}`} transform={`translate(16, ${src.y - 12})`}>
              <rect
                width={140}
                height={24}
                rx={4}
                fill={selectedId === src.id ? "#0ea5e9" : "#18181b"}
                stroke="#3f3f46"
              />
              <text
                x={8}
                y={16}
                fill="#f4f4f5"
                fontSize={11}
                fontFamily="monospace"
              >
                {src.label.slice(0, 16)}
              </text>
            </g>
          ))}

          {model.assets.map((asset) => (
            <g
              key={`asset-${asset.code}`}
              transform={`translate(320, ${asset.y - 14})`}
            >
              <rect
                width={80}
                height={28}
                rx={6}
                fill="#0f172a"
                stroke="#38bdf8"
              />
              <text
                x={40}
                y={18}
                textAnchor="middle"
                fill="#e0f2fe"
                fontSize={12}
                fontWeight="bold"
                fontFamily="monospace"
              >
                {asset.code}
              </text>
            </g>
          ))}

          {model.destinations.map((dst) => (
            <g key={`dst-${dst.id}`} transform={`translate(564, ${dst.y - 12})`}>
              <rect
                width={140}
                height={24}
                rx={4}
                fill={selectedId === dst.id ? "#0ea5e9" : "#18181b"}
                stroke="#3f3f46"
              />
              <text
                x={8}
                y={16}
                fill="#f4f4f5"
                fontSize={11}
                fontFamily="monospace"
              >
                {dst.label.slice(0, 16)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Keyboard-accessible node & flow list fallback */}
      <div
        data-testid="sankey-accessible-list"
        role="region"
        aria-label="Keyboard-accessible ranked payment flows"
        className="space-y-1.5"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Ranked Source → Asset → Destination Flows
        </p>
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10 bg-black/30">
          {model.links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelect?.(link.sourceId)}
                  className="rounded px-1.5 py-0.5 font-mono text-cyan-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {link.sourceLabel}
                </button>
                <span className="text-zinc-500">→</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-semibold text-white">
                  {link.assetCode}
                </span>
                <span className="text-zinc-500">→</span>
                <button
                  type="button"
                  onClick={() => onSelect?.(link.destinationId)}
                  className="rounded px-1.5 py-0.5 font-mono text-cyan-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {link.destinationLabel}
                </button>
              </div>
              <span className="font-mono text-zinc-300">
                {formatExactNumber(link.operationCount)} ops
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
