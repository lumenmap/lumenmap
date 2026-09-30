"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn, formatExactNumber, truncateAddress } from "@/lib/utils";
import {
  encodeFlowEdges,
  type FlowEdgeEncoding,
  type FlowEdgeWeightMetric,
} from "@/lib/metrics/flow-edge-encoding";

/**
 * Minimal structural shapes of the Flow graph model. They are intentionally a
 * subset of `FlowNode` / `FlowEdge` from the Flow graph model so the full model
 * types can be passed in directly once it lands.
 */
export interface FlowTableNode {
  id: string;
  label: string;
  category?: string;
}

export interface FlowTableEdge {
  id: string;
  source: string;
  destination: string;
  assetKey: string;
  asset?: { code: string };
  /** Aggregated amount in minor units (stroops, 7 decimals). */
  amount: string;
  operationCount: number;
}

type SortDirection = "asc" | "desc";
type AriaSort = "ascending" | "descending" | "none";

const STROOPS_PER_UNIT = 10_000_000;

function amountToUnits(amount: string): number {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed / STROOPS_PER_UNIT : 0;
}

function assetLabel(edge: FlowTableEdge): string {
  return edge.asset?.code ?? edge.assetKey.split(":")[0] ?? edge.assetKey;
}

function useSort<K extends string>(initialKey: K) {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [direction, setDirection] = useState<SortDirection>("desc");

  const onSort = (key: K) => {
    if (key === sortKey) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection("desc");
  };

  const ariaSort = (key: K): AriaSort =>
    key !== sortKey ? "none" : direction === "asc" ? "ascending" : "descending";

  return { sortKey, direction, onSort, ariaSort };
}

function SortIcon({ state }: { state: AriaSort }) {
  if (state === "none") {
    return <ArrowUpDown className="h-3 w-3 text-zinc-600" aria-hidden="true" />;
  }
  return state === "ascending" ? (
    <ArrowUp className="h-3 w-3 text-white" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3 w-3 text-white" aria-hidden="true" />
  );
}

function SortableHeader({
  label,
  state,
  onSort,
}: {
  label: string;
  state: AriaSort;
  onSort: () => void;
}) {
  return (
    <th scope="col" aria-sort={state} className="p-0">
      <button
        type="button"
        onClick={onSort}
        className="flex w-full items-center gap-1 px-3 py-2 text-left texe-xs font-medium uppercase tracking-wide text-zinc-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light"
      >
        {label}
        <SortIcon state={state} />
      </button>
    </th>
  );
}

function SelectableRow({
  id,
  selected,
  onSelect,
  children,
}: {
  id: string;
  selected: boolean;
  onSelect?: (id: string) => void;
  children: ReactNode;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!onSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
    }
  };

  return (
    <tr
      data-row-id={id}
      tabIndex={onSelect ? 0 : undefined}
      aria-selected={onSelect ? selected : undefined}
      onClick={onSelect ? () => onSelect(id) : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        "border-b border-white/5 last:border-0",
        onSelect &&
          "cursor-pointer hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light",
        selected && "bg-white/10",
      )}
    >
      {children}
    </tr>
  );
}

type EdgeSortKey = "source" | "destination" | "asset" | "amount" | "operations";
type NodeSortKey = "label" | "category" | "inflow" | "outflow";

export interface FlowDataTableProps {
  nodes: readonly FlowTableNode[];
  edges: readonly FlowTableEdge[];
  /** Also render a nodes table below the edges table. */
  showNodes?: boolean;
  /** Id of the selected node or edge (shared with DetailPanel). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  caption?: string;
  /** Weight metric used for edge thickness (operations or asset amount). */
  weightMetric?: FlowEdgeWeightMetric;
}

const HEADER_CELL =
  "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400";

export function FlowDataTable({
  nodes,
  edges,
  showNodes = false,
  selectedId = null,
  onSelect,
  caption = "Flow graph edges",
  weightMetric = "operations",
}: FlowDataTableProps) {
  const edgeSort = useSort<EdgeSortKey>("amount");
  const nodeSort = useSort<NodeSortKey>("outflow");

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) map.set(node.id, node.label);
    return map;
  }, [nodes]);

  const resolveLabel = (id: string) => labelById.get(id) ?? truncateAddress(id);

  const edgeEncodings = useMemo(
    () => encodeFlowEdges(edges, weightMetric),
    [edges, weightMetric],
  );

  const edgeRows = useMemo(() => {
    const rows = edges.map((edge) => ({
      edge,
      sourceLabel: labelById.get(edge.source) ?? truncateAddress(edge.source),
      destinationLabel:
        labelById.get(edge.destination) ?? truncateAddress(edge.destination),
      asset: assetLabel(edge),
      amount: amountToUnits(edge.amount),
      encoding: edgeEncodings.get(edge.id),
    }));
    const { sortKey, direction } = edgeSort;
    return rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "source") cmp = a.sourceLabel.localeCompare(b.sourceLabel);
      else if (sortKey === "destination")
        cmp = a.destinationLabel.localeCompare(b.destinationLabel);
      else if (sortKey === "asset") cmp = a.asset.localeCompare(b.asset);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else cmp = a.edge.operationCount - b.edge.operationCount;
      if (cmp === 0) cmp = a.edge.id.localeCompare(b.edge.id);
      return direction === "asc" ? cmp : -cmp;
    });
  }, [edges, labelById, edgeSort, edgeEncodings]);

  const nodeRows = useMemo(() => {
    const totals = new Map<string, { inflow: number; outflow: number }>();
    for (const edge of edges) {
      const src = totals.get(edge.source) ?? { inflow: 0, outflow: 0 };
      src.outflow += edge.operationCount;
      totals.set(edge.source, src);
      const dst = totals.get(edge.destination) ?? { inflow: 0, outflow: 0 };
      dst.inflow += edge.operationCount;
      totals.set(edge.destination, dst);
    }
    const rows = nodes.map((node) => ({
      node,
      category: node.category ?? "",
      ...(totals.get(node.id) ?? { inflow: 0, outflow: 0 }),
    }));
    const { sortKey, direction } = nodeSort;
    return rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "label") cmp = a.node.label.localeCompare(b.node.label);
      else if (sortKey === "category") cmp = a.category.localeCompare(b.category);
      else if (sortKey === "inflow") cmp = a.inflow - b.inflow;
      else cmp = a.outflow - b.outflow;
      if (cmp === 0) cmp = a.node.id.localeCompare(b.node.id);
      return direction === "asc" ? cmp : -cmp;
    });
  }, [nodes, edges, nodeSort]);

  if (edges.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-zinc-500">
        No flow edges to display.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="px-3 py-2 text-left texe-xs text-zinc-500">
            {caption} ({formatExactNumber(edges.length)} edges)
          </caption>
          <thead>
            <tr className="border-b border-white/10">
              <SortableHeader label="Source" state={edgeSort.ariaSort("source")} onSort={() => edgeSort.onSort("source")} />
              <SortableHeader label="Destination" state={edgeSort.ariaSort("destination")} onSort={() => edgeSort.onSort("destination")} />
              <SortableHeader label="Asset" state={edgeSort.ariaSort("asset")} onSort={() => edgeSort.onSort("asset")} />
              <SortableHeader label="Amount" state={edgeSort.ariaSort("amount")} onSort={() => edgeSort.onSort("amount")} />
              <SortableHeader label="Operations" state={edgeSort.ariaSort("operations")} onSort={() => edgeSort.onSort("operations")} />
            </tr>
          </thead>
          <tbody>
            {edgeRows.map(({ edge, sourceLabel, destinationLabel, asset, amount, encoding }) => (
              <SelectableRow
                key={edge.id}
                id={edge.id}
                selected={selectedId === edge.id}
                onSelect={onSelect}
              >
                <td className="px-3 py-2 text-zinc-200" title={edge.source}>{sourceLabel}</td>
                <td className="px-3 py-2 text-zinc-200" title={edge.destination}>{destinationLabel}</td>
                <td className="px-3 py-2 text-zinc-400">{asset}</td>
                <td className="px-3 py-2 font-mono text-zinc-200">{formatExactNumber(amount)}</td>
                <td className="px-3 py-2 font-mono text-zinc-300">{formatExactNumber(edge.operationCount)}</td>
                <td className="px-3 py-2">
                  <EdgeWeightBar encoding={encoding} />
                </td>
              </SelectableRow>
            ))
          </tbody>
        </table>
      </div>

      {showNodes && nodes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="px-3 py-2 text-left text-xs text-zinc-500">
              Flow graph nodes ({formatExactNumber(nodes.length)} accounts)
            </caption>
            <thead>
              <tr className="border-b border-white/10">
                <SortableHeader label="Account" state={nodeSort.ariaSort("label")} onSort={() => nodeSort.onSort("label")} />
                <SortableHeader label="Category" state={nodeSort.ariaSort("category")} onSort={() => nodeSort.onSort("category")} />
                <SortableHeader label="Incoming ops" state={nodeSort.ariaSort("inflow")} onSort={() => nodeSort.onSort("inflow")} />
                <SortableHeader label="Outgoing ops" state={nodeSort.ariaSort("outflow")} onSort={() => nodeSort.onSort("outflow")} />
                <th scope="col" className={HEADER_CELL}>Account id</th>
              </tr>
            </thead>
            <tbody>
              {nodeRows.map(({ node, category, inflow, outflow }) => (
                <SelectableRow
                  key={node.id}
                  id={node.id}
                  selected={selectedId === node.id}
                  onSelect={onSelect}
                >
                  <td className="px-3 py-2 text-zinc-200">{resolveLabel(node.id)}</td>
                  <td className="px-3 py-2 text-zinc-400">{category || "—"}</td>
                  <td className="px-3 py-2 font-mono text-zinc-300">{formatExactNumber(inflow)}</td>
                  <td className="px-3 py-2 font-mono text-zinc-300">{formatExactNumber(outflow)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{truncateAddress(node.id)}</td>
                </SelectableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Static weight bar shown in the edge table. Thickness and opacity
 * are driven by the shared encoding function, so the table and the canvas
 * agree on relative weight. No animation is used, so reduced-motion users
 * still see the encoding.
 */
function EdgeWeightBar({ encoding }: { encoding?: FlowEdgeEncoding }) {
  if (!encoding) {
    return <span className="text-xs text-zinc-600">—</span>;
  }
  const { strokeWidth, opacity, tooltip } = encoding;
  return (
    <span
      className="inline-flex h-4 w-24 items-center"
      title={tooltip}
      aria-label={tooltip}
      data-testid="flow-edge-weight"
    >
      <span
        className="w-full rounded-full bg-stellar-light"
        style={{ height: `${strokeWidth}px`, opacity }}
      />
    </span>
  );
}

export type FlowView = "graph" | "table";

export type FlowAssetMode = "xlm" | "usdc" | "op_count";

/** "Graph / Table" toggle meant to sit beside the Flow canvas. */
export function FlowViewToggle({
  view,
  onChange,
}: {
  view: FlowView;
  onChange: (view: FlowView) => void;
}) {
  const options: { value: FlowView; label: string }[] = [
    { value: "graph", label: "Graph" },
    { value: "table", label: "Table" },
  ];
  return (
    <div role="group" aria-label="Flow view" className="inline-flex rounded-lg border border-white/10 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium text-zinc-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light",
            view === option.value && "bg-white/10 text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Asset mode selector for Flow edges (XLM, USDC, or operation count). */
export function FlowAssetModeSelector({
  assetMode,
  onChange,
}: {
  assetMode: FlowAssetMode;
  onChange: (mode: FlowAssetMode) => void;
}) {
  const options: { value: FlowAssetMode; label: string }[] = [
    { value: "xlm", label: "XLM" },
    { value: "usdc", label: "USDC" },
    { value: "op_count", label: "Operations" },
  ];
  return (
    <div role="group" aria-label="Flow asset mode" className="inline-flex rounded-lg border border-white/10 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={assetMode === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium text-zinc-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light",
            assetMode === option.value && "bg-white/10 text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
