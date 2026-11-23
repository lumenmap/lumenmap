"use client";

import { useMemo } from "react";
import type { FlowEdge, FlowNode } from "@/lib/flow/graph";
import { FLOW_MAX_EDGES } from "@/lib/flow/limits";
import { buildSankeyGroups, SANKEY_TOP_N_PER_ASSET, type SankeyAssetGroup } from "@/lib/flow/sankey";
import { truncateAddress } from "@/lib/utils";

type Band = { y: number; height: number };

function ribbon(x1: number, y1: number, x2: number, y2: number, height: number) {
  const c = (x1 + x2) / 2;
  return `M${x1},${y1} C${c},${y1} ${c},${y2} ${x2},${y2} L${x2},${y2 + height} C${c},${y2 + height} ${c},${y1 + height} ${x1},${y1 + height}Z`;
}

function AssetSankey({ group, labels, onSelect }: {
  group: SankeyAssetGroup;
  labels: Map<string, string>;
  onSelect?: (id: string) => void;
}) {
  const totals = (field: "source" | "destination") => [...new Set(group.edges.map((edge) => edge[field]))]
    .map((id) => ({ id, amount: group.edges.reduce((sum, edge) => sum + (edge[field] === id ? BigInt(edge.amount) : BigInt(0)), BigInt(0)) }))
    .sort((a, b) => a.amount === b.amount ? a.id.localeCompare(b.id) : a.amount > b.amount ? -1 : 1);
  const sources = totals("source");
  const destinations = totals("destination");
  const total = group.edges.reduce((sum, edge) => sum + BigInt(edge.amount), BigInt(0));
  const height = Math.max(360, Math.max(sources.length, destinations.length) * 30);
  const plotHeight = height - 40 - (Math.max(sources.length, destinations.length) - 1) * 12;
  const pixels = (amount: bigint) => Number((amount * BigInt(1_000_000)) / total) * plotHeight / 1_000_000;
  const bands = (items: typeof sources) => {
    const result = new Map<string, Band>();
    let y = (height - plotHeight - (items.length - 1) * 12) / 2;
    for (const item of items) {
      const bandHeight = pixels(item.amount);
      result.set(item.id, { y, height: bandHeight });
      y += bandHeight + 12;
    }
    return result;
  };
  const sourceBands = bands(sources);
  const destinationBands = bands(destinations);
  const paths = group.edges.map((edge, index) => {
    const thickness = pixels(BigInt(edge.amount));
    const source = sourceBands.get(edge.source)!;
    const destination = destinationBands.get(edge.destination)!;
    const previous = group.edges.slice(0, index);
    const offset = (field: "source" | "destination") => previous.reduce(
      (sum, item) => sum + (item[field] === edge[field] ? pixels(BigInt(item.amount)) : 0), 0,
    );
    return {
      edge, thickness,
      sourceY: source.y + offset("source"),
      assetY: (height - plotHeight) / 2 + previous.reduce((sum, item) => sum + pixels(BigInt(item.amount)), 0),
      destinationY: destination.y + offset("destination"),
    };
  });
  const name = (id: string) => labels.get(id) ?? truncateAddress(id);
  const assetLabel = group.asset === "XLM" ? "XLM" : `USDC · ${truncateAddress(group.assetKey.slice(5))}`;
  return <section aria-label={`${assetLabel} payment flows`} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <h3 className="font-semibold text-white">{assetLabel}</h3>
      <p className="rounded-md border border-amber-800/70 bg-amber-950/40 px-2 py-1 text-xs text-amber-100">
        Top {Math.min(SANKEY_TOP_N_PER_ASSET, group.eligibleCount)} of {group.eligibleCount} eligible edges · {group.coveragePercent.toFixed(1)}% of returned {group.asset} volume
      </p>
    </div>
    <div className="max-w-full overflow-x-auto" role="region" aria-label={`${assetLabel} Sankey chart, scroll horizontally on narrow screens`} tabIndex={0}>
      <svg width="780" height={height} viewBox={`0 0 780 ${height}`} aria-hidden="true" className="block max-w-none">
        {paths.map(({ edge, thickness, sourceY, assetY, destinationY }) => <g key={edge.id} fill={group.asset === "XLM" ? "#64c3d9" : "#95cda3"} fillOpacity="0.55">
          <path d={ribbon(162, sourceY, 390, assetY, thickness)} />
          <path d={ribbon(402, assetY, 630, destinationY, thickness)} />
        </g>)}
        {[...sourceBands].map(([id, band]) => <g key={`source-${id}`}><title>{name(id)}</title><rect x="150" y={band.y} width="12" height={band.height} fill="#64c3d9" /><text x="142" y={band.y + band.height / 2} textAnchor="end" dominantBaseline="middle" fill="white" fontSize="11">{name(id).slice(0, 18)}</text></g>)}
        <rect x="390" y={(height - plotHeight) / 2} width="12" height={plotHeight} fill={group.asset === "XLM" ? "#64c3d9" : "#95cda3"} />
        <text x="396" y={(height - plotHeight) / 2 - 7} textAnchor="middle" fill="white" fontSize="12">{group.asset}</text>
        {[...destinationBands].map(([id, band]) => <g key={`destination-${id}`}><title>{name(id)}</title><rect x="630" y={band.y} width="12" height={band.height} fill="#95cda3" /><text x="650" y={band.y + band.height / 2} dominantBaseline="middle" fill="white" fontSize="11">{name(id).slice(0, 18)}</text></g>)}
      </svg>
    </div>
    <details className="mt-3 text-xs text-zinc-300">
      <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light">Keyboard-accessible node list</summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {([["Sources", sources], ["Destinations", destinations]] as const).map(([heading, items]) => <div key={heading}>
          <h4 className="mb-1 font-semibold">{heading}</h4>
          <ul className="space-y-1">{items.map(({ id }) => <li key={id}><button type="button" onClick={() => onSelect?.(id)} className="max-w-full break-all text-left underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light">{name(id)}</button></li>)}</ul>
        </div>)}
      </div>
      <p className="mt-2">Asset: {assetLabel}</p>
    </details>
  </section>;
}

/** Fixed geometry has no animation and remains static under reduced motion. */
export function FlowSankey({ nodes, edges, sampled = false, onSelect }: {
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
  sampled?: boolean;
  onSelect?: (id: string) => void;
}) {
  const groups = useMemo(() => buildSankeyGroups(edges), [edges]);
  const labels = useMemo(() => new Map(nodes.map((node) => [node.id, node.label])), [nodes]);
  if (groups.length === 0) return <p role="status" className="text-sm text-zinc-400">No complete XLM or USDC payment amounts available for Sankey.</p>;
  return <div className="min-w-0 space-y-4">
    <p className="text-xs text-zinc-400">Static source → asset → destination layout. Widths compare amounts within each asset only. Per-asset cap: {SANKEY_TOP_N_PER_ASSET} edges. {sampled ? `The API caps the overview at ${FLOW_MAX_EDGES} edges ranked by operations; coverage below is within that sample, not the full network.` : "Coverage is based on returned eligible edges."} Edges with missing or zero amounts are omitted.</p>
    {groups.map((group) => <AssetSankey key={group.assetKey} group={group} labels={labels} onSelect={onSelect} />)}
  </div>;
}
