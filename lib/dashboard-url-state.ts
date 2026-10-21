import { isValidPeriod } from "@/lib/periods";
import type { DashboardMetricId, Period, TreemapNode } from "@/lib/types";
import type { ChartViewId, TreemapViewId } from "@/lib/constants";
import { CHART_VIEWS, TREEMAP_VIEWS } from "@/lib/constants";

const METRIC_IDS: DashboardMetricId[] = [
  "ops",
  "xlm_volume",
  "usdc",
  "transactions",
  "protocol_tvl",
];

export function isValidMetric(
  value: string | null | undefined,
): value is DashboardMetricId {
  return !!value && METRIC_IDS.includes(value as DashboardMetricId);
}

export function isValidTreemapView(
  value: string | null | undefined,
): value is TreemapViewId {
  return TREEMAP_VIEWS.some((view) => view.id === value);
}

export function isValidChartView(
  value: string | null | undefined,
): value is ChartViewId {
  return CHART_VIEWS.some((view) => view.id === value);
}

/** Stable path segment for a treemap node (prefer id, fall back to name). */
export function treemapPathSegment(node: TreemapNode): string {
  return String(node.id ?? node.name);
}

export function encodeDrillPath(path: TreemapNode[]): string | null {
  if (path.length === 0) return null;
  return path
    .map((node) => encodeURIComponent(treemapPathSegment(node)))
    .join("/");
}

export function decodeDrillPathParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .filter(Boolean);
}

/**
 * Walk the treemap using encoded path segments. Stops at the first missing
 * child so stale share links restore the deepest still-valid level.
 */
export function resolveDrillPath(
  root: TreemapNode,
  segments: string[],
): TreemapNode[] {
  const resolved: TreemapNode[] = [];
  let current = root;

  for (const segment of segments) {
    const child = current.children?.find(
      (node) => treemapPathSegment(node) === segment || node.name === segment,
    );
    if (!child) break;
    resolved.push(child);
    current = child;
  }

  return resolved;
}

export type DashboardUrlState = {
  period: Period;
  metric: DashboardMetricId;
  view?: TreemapViewId;
  /**
   * Top-level chart view. Only `flow` is encoded in the URL; the default
   * `treemap` view leaves `view` to carry the treemap sub-view instead.
   */
  chartView?: ChartViewId;
  pathSegments: string[];
  searchQuery?: string;
  comparePeriod?: Period;
  network?: "mainnet" | "testnet";
  flowMode?: "graph" | "table";
  egoAddress?: string;
};

export function parseDashboardUrlSearch(
  search: string,
): Partial<DashboardUrlState> {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const next: Partial<DashboardUrlState> = {
    pathSegments: decodeDrillPathParam(params.get("path")),
  };
  const searchQuery = params.get("q");
  if (searchQuery) next.searchQuery = searchQuery;

  const period = params.get("period");
  if (isValidPeriod(period)) next.period = period;

  const compare = params.get("compare");
  if (isValidPeriod(compare)) next.comparePeriod = compare;

  const metric = params.get("metric");
  if (isValidMetric(metric)) next.metric = metric;

  // `view` carries the top-level Flow selection when it is `flow`; otherwise it
  // keeps encoding the treemap sub-view (operation types vs accounts).
  const view = params.get("view");
  if (view === "flow") next.chartView = "flow";
  else if (isValidTreemapView(view)) next.view = view;

  const network = params.get("network");
  if (network === "mainnet" || network === "testnet") next.network = network;

  const flowMode = params.get("flowMode");
  if (flowMode === "graph" || flowMode === "table") next.flowMode = flowMode;

  const egoAddress = params.get("ego");
  if (egoAddress && isValidStellarAddress(egoAddress)) {
    next.egoAddress = egoAddress;
  }

  return next;
}

function isValidStellarAddress(address: string): boolean {
  return /^[GC][A-Z2-7]{55}$/.test(address);
}

export function writeDashboardUrlSearch(input: {
  period: Period;
  metric: DashboardMetricId;
  view: TreemapViewId;
  path: TreemapNode[];
  currentSearch?: string;
  comparePeriod?: Period | null;
  network?: "mainnet" | "testnet";
  flowMode?: "graph" | "table" | null;
  egoAddress?: string | null;
  chartView?: ChartViewId;
  searchQuery?: string;
}): string {
  const params = new URLSearchParams(
    (input.currentSearch ?? "").replace(/^\?/, ""),
  );
  params.set("period", input.period);
  params.set("metric", input.metric);
  // Flow replaces the treemap sub-view in the shared `view` param so Flow URLs
  // stay compatible with the flag gate (`?view=flow`) and the visual harness.
  params.set("view", input.chartView === "flow" ? "flow" : input.view);
  if (input.network && input.network !== "mainnet") {
    params.set("network", input.network);
  } else {
    params.delete("network");
  }
  if (input.comparePeriod) params.set("compare", input.comparePeriod);
  else params.delete("compare");
  if (input.searchQuery) params.set("q", input.searchQuery);
  else params.delete("q");

  const encodedPath = encodeDrillPath(input.path);
  if (encodedPath) params.set("path", encodedPath);
  else params.delete("path");

  if (input.flowMode) params.set("flowMode", input.flowMode);
  else params.delete("flowMode");

  if (input.egoAddress) params.set("ego", input.egoAddress);
  else params.delete("ego");

  const query = params.toString();
  return query ? `?${query}` : "";
}
