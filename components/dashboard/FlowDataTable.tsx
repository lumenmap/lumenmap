"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn, formatExactNumber, formatPercent, truncateAddress } from "@/lib/utils";
import {
  FLOW_METHODOLOGY_ANCHORS,
  flowMethodologyHref,
} from "@/lib/metrics/flow-methodology-anchors";

/**
 * Minimal structural shapes of the Flow graph model. They are intentionally a
 * subset of `FlowNode` / `FlowEdge` from the Flow graph model so the full model
 * types can be passed in directly once it lands.
 */
export interface FlowTableNode {
  id: string;
  label: string;
  category?: string;
  protocol?: string;
}

export interface FlowTableEdge {
  id: string;
  source: string;
  destination: string;
  assetKey: string;
  asset?: { code: string };
  /** Aggregated amount in minor units (stroops, 7 decimals). */
  amount: string;
  /** False when an edge contains operations without a reliable amount. */
  amountComplete?: boolean;
  operationCount: number;
}

/** Period totals the Flow API reports alongside a top-N edge sample. */
export interface FlowCoverageTotals {
  totalEdges: number;
  totalOperations: number;
  configuredLimit: number;
}

export interface FlowCoverage {
  returnedEdges: number;
  totalEdges: number;
  returnedOperations: number;
  totalOperations: number;
  coveragePercent: number;
  sampled: boolean;
  configuredLimit: number;
}

/**
 * Build top-N sampling coverage for returned Flow edges: returned vs total
 * edges plus operations-weighted coverage percent (same zero-parent rule as
 * the treemap `buildCoverage`). Returns undefined when there are no edges.
 */
export function buildFlowCoverage(
  edges: readonly FlowTableEdge[],
  totals: FlowCoverageTotals,
): FlowCoverage | undefined {
  if (edges.length === 0) {
    return undefined;
  }
  const returnedOperations = edges.reduce(
    (sum, edge) => sum + edge.operationCount,
    0,
  );
  return {
    returnedEdges: edges.length,
    totalEdges: totals.totalEdges,
    returnedOperations,
    totalOperations: totals.totalOperations,
    coveragePercent:
      totals.totalOperations > 0
        ? (returnedOperations / totals.totalOperations) * 100
        : 0,
    sampled: edges.length < totals.totalEdges,
    configuredLimit: totals.configuredLimit,
  };
}

/**
 * Honesty badge for top-N sampled Flow graphs. Rendered whenever coverage
 * is below 100% so absences read as "not in the sample", not "no activity".
 */
export function FlowCoverageBadge({ coverage }: { coverage: FlowCoverage }) {
  return (
    <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-800/70 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-100">
      <span>
        Sampled · top {formatExactNumber(coverage.configuredLimit)} of{" "}
        {formatExactNumber(coverage.totalEdges)} edges ·{" "}
        {formatPercent(coverage.coveragePercent)} of operations
      </span>
      <a
        href={flowMethodologyHref(FLOW_METHODOLOGY_ANCHORS.sampling)}
        className="font-medium underline hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        Methodology
      </a>
    </p>
  );
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
        className="flex min-h-[44px] w-full items-center gap-1 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light"
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
  /** Top-N sampling coverage; badge renders only when coverage is below 100%. */
  coverage?: FlowCoverage | null;
}

const HEADER_CELL =
  "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400";

/**
 * Mobile-first card list used below the `sm` breakpoint. Tables with five
 * columns cannot fit 320–390px viewports without forcing page-level horizontal
 * scroll, so we render the same data as stacked cards instead.
 */
function EdgeCardList({
  rows,
  selectedId,
  onSelect,
}: {
  rows: readonly {
    edge: FlowTableEdge;
    sourceLabel: string;
    destinationLabel: string;
    asset: string;
    amount: number;
  }[];
  selectedId: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-white/5">
      {rows.map(({ edge, sourceLabel, destinationLabel, asset, amount }) => {
        const selected = selectedId === edge.id;
        const interactive = Boolean(onSelect);
        return (
          <li key={edge.id}>
            <button
              type="button"
              data-row-id={edge.id}
              aria-selected={interactive ? selected : undefined}
              onClick={interactive ? () => onSelect?.(edge.id) : undefined}
              disabled={!interactive}
              className={cn(
                "flex w-full flex-col gap-2 px-3 py-3 text-left",
                interactive &&
                  "cursor-pointer hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light",
                selected && "bg-white/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-zinc-200" title={edge.source}>
                  {sourceLabel}
                </span>
                <span className="shrink-0 text-xs text-zinc-500" aria-hidden="true">
                  →
                </span>
                <span
                  className="truncate text-sm text-zinc-200"
                  title={edge.destination}
                >
                  {destinationLabel}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-zinc-500">Asset</dt>
                  <dd className="truncate text-zinc-400">{asset}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-zinc-500">Amount</dt>
                  <dd className="truncate font-mono text-zinc-200">
                    {formatExactNumber(amount)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-zinc-500">Ops</dt>
                  <dd className="truncate font-mono text-zinc-300">
                    {formatExactNumber(edge.operationCount)}
                  </dd>
                </div>
              </dl>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NodeCardList({
  rows,
  selectedId,
  onSelect,
  resolveLabel,
}: {
  rows: readonly {
    node: FlowTableNode;
    category: string;
    inflow: number;
    outflow: number;
  }[];
  selectedId: string | null;
  onSelect?: (id: string) => void;
  resolveLabel: (id: string) => string;
}) {
  return (
    <ul className="divide-y divide-white/5">
      {rows.map(({ node, category, inflow, outflow }) => {
        const selected = selectedId === node.id;
        const interactive = Boolean(onSelect);
        return (
          <li key={node.id}>
            <button
              type="button"
              data-row-id={node.id}
              aria-selected={interactive ? selected : undefined}
              onClick={interactive ? () => onSelect?.(node.id) : undefined}
              disabled={!interactive}
              className={cn(
                "flex w-full flex-col gap-2 px-3 py-3 text-left",
                interactive &&
                  "cursor-pointer hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light",
                selected && "bg-white/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-zinc-200">
                  {resolveLabel(node.id)}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {category || "—"}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-zinc-500">In</dt>
                  <dd className="truncate font-mono text-zinc-300">
                    {formatExactNumber(inflow)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-zinc-500">Out</dt>
                  <dd className="truncate font-mono text-zinc-300">
                    {formatExactNumber(outflow)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-zinc-500">Id</dt>
                  <dd className="truncate font-mono text-zinc-500">
                    {truncateAddress(node.id)}
                  </dd>
                </div>
              </dl>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function FlowDataTable({
  nodes,
  edges,
  showNodes = false,
  selectedId = null,
  onSelect,
  caption = "Flow graph edges",
  coverage = null,
}: FlowDataTableProps) {
  const edgeSort = useSort<EdgeSortKey>("amount");
  const nodeSort = useSort<NodeSortKey>("outflow");
  const [isRetrying, setIsRetrying] = useState(false);
  const retryBusy = isRetrying || retryPending;

  const handleRetry = async () => {
    if (retryBusy) {
      return;
    }
    setIsRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setIsRetrying(false);
    }
  };

  const totalsById = useMemo(() => {
    const totals = new Map<string, { inflow: number; outflow: number }>();
    for (const edge of edges) {
      const src = totals.get(edge.source) ?? { inflow: 0, outflow: 0 };
      src.outflow += edge.operationCount;
      totals.set(edge.source, src);
      const dst = totals.get(edge.destination) ?? { inflow: 0, outflow: 0 };
      dst.inflow += edge.operationCount;
      totals.set(edge.destination, dst);
    }
    return totals;
  }, [edges]);

  // Default row selection writes through to the shared DetailPanel selection
  // state. Explicit `onSelect`/`selectedId` props remain controlled overrides.
  // Edge ids never resolve to a node, so edge-row activation is a no-op here
  // (node-only wiring per #290). Note `DashboardProvider` resets the shared
  // selection on period/metric/view/network change, so a Flow selection does
  // not survive period shifts; preserving entity selection across periods is
  // deferred until the Flow canvas dataset (#287) is integrated.
  const effectiveOnSelect =
    onSelect ??
    (dashboard
      ? (id: string) => {
          const node = nodes.find((candidate) => candidate.id === id);
          if (!node) return;
          const totals = totalsById.get(id) ?? { inflow: 0, outflow: 0 };
          dashboard.setSelectedNode(
            flowTableNodeToSelectedNode(node, {
              inflowOps: totals.inflow,
              outflowOps: totals.outflow,
            }),
          );
        }
      : undefined);
  const effectiveSelectedId =
    selectedId ?? dashboard?.selectedNode?.meta?.id ?? null;

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
      amount: edge.amountComplete === false ? null : amountToUnits(edge.amount),
    }));
    const { sortKey, direction } = edgeSort;
    return rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "source") cmp = a.sourceLabel.localeCompare(b.sourceLabel);
      else if (sortKey === "destination")
        cmp = a.destinationLabel.localeCompare(b.destinationLabel);
      else if (sortKey === "asset") cmp = a.asset.localeCompare(b.asset);
      else if (sortKey === "amount") cmp = (a.amount ?? -1) - (b.amount ?? -1);
      else cmp = a.edge.operationCount - b.edge.operationCount;
      if (cmp === 0) cmp = a.edge.id.localeCompare(b.edge.id);
      return direction === "asc" ? cmp : -cmp;
    });
  }, [edges, labelById, edgeSort, edgeEncodings]);

  const nodeRows = useMemo(() => {
    const rows = nodes.map((node) => ({
      node,
      category: node.category ?? "",
      ...(totalsById.get(node.id) ?? { inflow: 0, outflow: 0 }),
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
  }, [nodes, totalsById, nodeSort]);

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-4">
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20 p-3">
          <Skeleton className="mb-2 h-4 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        {showNodes && (
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20 p-3">
            <Skeleton className="mb-2 h-4 w-40" />
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-200">
        <p role="alert">{errorMessage}</p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleRetry();
            }}
            disabled={retryBusy}
            aria-busy={retryBusy}
            aria-label={
              retryBusy ? "Retrying flow data" : "Retry loading flow data"
            }
            className="gap-2 self-start border-red-500/30 text-red-100 hover:bg-red-500/10"
          >
            <RefreshCw
              className={`h-4 w-4 ${retryBusy ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {retryBusy ? "Retrying…" : "Retry"}
          </Button>
        )}
      </div>
    );
  }

  if (edges.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-zinc-500"
      >
        No flow edges to display.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {coverage &&
      (coverage.sampled || coverage.coveragePercent < 100) ? (
        <FlowCoverageBadge coverage={coverage} />
      ) : null}
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
                selected={effectiveSelectedId === edge.id}
                onSelect={effectiveOnSelect}
              >
                <td className="px-3 py-2 text-zinc-200" title={edge.source}>{sourceLabel}</td>
                <td className="px-3 py-2 text-zinc-200" title={edge.destination}>{destinationLabel}</td>
                <td className="px-3 py-2 text-zinc-400">{asset}</td>
                <td className="px-3 py-2 font-mono text-zinc-200">{amount === null ? "—" : formatExactNumber(amount)}</td>
                <td className="px-3 py-2 font-mono text-zinc-300">{formatExactNumber(edge.operationCount)}</td>
                <td className="px-3 py-2">
                  <EdgeWeightBar encoding={encoding} />
                </td>
              </SelectableRow>
            ))}
          </tbody>
        </table>
      </div>

      {showNodes && nodes.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20 sm:hidden">
            <p className="px-3 py-2 text-left text-xs text-zinc-500">
              Flow graph nodes ({formatExactNumber(nodes.length)} accounts)
            </p>
            <table className="w-full border-collapse">
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
                    selected={effectiveSelectedId === node.id}
                    onSelect={effectiveOnSelect}
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
        </>
      )}
      {showNodes && nodes.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-zinc-500"
        >
          No flow nodes to display.
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
            "min-h-[44px] rounded-md px-3 py-1 text-xs font-medium text-zinc-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light",
            view === option.value && "bg-white/10 text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}