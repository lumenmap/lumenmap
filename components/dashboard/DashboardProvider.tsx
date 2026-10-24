"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChartViewId, TreemapViewId } from "@/lib/constants";
import {
  parseDashboardUrlSearch,
  resolveDrillPath,
  writeDashboardUrlSearch,
} from "@/lib/dashboard-url-state";
import { findTreemapPath, type SearchResult } from "@/lib/search";
import { materializeSnapshot } from "@/lib/snapshots/materialize";
import type { ResearchSnapshot } from "@/lib/snapshots/types";
import type {
  ActivityVisualizationResponse,
  ActivityWindow,
  ApiErrorResponse,
  DashboardMetricId,
  Period,
  SelectedNode,
  TreemapNode,
} from "@/lib/types";

interface DashboardContextValue {
  visualization: "treemap" | "flow";
  setVisualization: (view: "treemap" | "flow") => void;
  period: Period;
  setPeriod: (period: Period) => void;
  comparePeriod: Period | null;
  setComparePeriod: (period: Period | null) => void;
  comparisonData?: ActivityVisualizationResponse;
  comparisonLoading: boolean;
  comparisonError: Error | null;
  /**
   * Treemap period-over-period diff overlay (issue #447). When enabled, the
   * dashboard fetches the previous equal-length window so tiles can be
   * colored by percent change against it.
   */
  treemapDiff: boolean;
  setTreemapDiff: (enabled: boolean) => void;
  /** Dataset for the previous equal-length window; only fetched in diff mode. */
  previousData?: ActivityVisualizationResponse;
  previousLoading: boolean;
  previousError: Error | null;
  treemapView: TreemapViewId;
  setTreemapView: (view: TreemapViewId) => void;
  /** Top-level chart view: hierarchical treemap or experimental flow. */
  chartView: ChartViewId;
  setChartView: (view: ChartViewId) => void;
  /** Whether the experimental Flow view is available; hides the switcher when false. */
  flowViewEnabled: boolean;
  metric: DashboardMetricId;
  setMetric: (metric: DashboardMetricId) => void;
  network: import("@/lib/network").DashboardNetworkId;
  setNetwork: (network: import("@/lib/network").DashboardNetworkId) => void;
  data?: ActivityVisualizationResponse;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
  /** Open DetailPanel for a watched entity, and Flow ego when Flow is enabled. */
  focusWatchedEntity: (node: SelectedNode) => void;
  activeLevelPath: TreemapNode[];
  setActiveLevelPath: (path: TreemapNode[]) => void;
  /** Active search focus used to open treemap context. */
  focusRequest: SearchResult | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectSearchResult: (result: SearchResult) => void;
  flowMode: "graph" | "table";
  setFlowMode: (mode: "graph" | "table") => void;
  egoAddress: string | null;
  setEgoAddress: (address: string | null) => void;
  /** True when the dashboard is showing a frozen /s/:id snapshot. */
  readOnly: boolean;
  snapshot: ResearchSnapshot | null;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

async function fetchActivity(
  period: Period,
  network: import("@/lib/network").DashboardNetworkId,
  window: ActivityWindow = "current",
): Promise<ActivityVisualizationResponse> {
  const params = new URLSearchParams({ period });
  if (network !== "mainnet") params.set("network", network);
  if (window !== "current") params.set("window", window);
  const response = await fetch(`/api/v1/activity?${params}`);
  if (!response.ok) {
    const body = (await response.json()) as { code?: string; message?: string };
    const error = new Error(body.message ?? "Failed to load activity data") as Error & {
      code?: string;
    };
    if (body.code) {
      error.code = body.code;
    }
    throw error;
  }
  return response.json() as Promise<ActivityVisualizationResponse>;
}

function searchResultToSelectedNode(result: SearchResult): SelectedNode {
  return {
    name: result.label,
    value: result.opCount ?? 0,
    share: 0,
    meta: {
      type: result.nodeType,
      id: result.id ?? result.issuer,
      category: result.category,
      protocol: result.protocol,
      opCount: result.opCount,
    },
  };
}

function selectedNodeFromSearch(
  data: ActivityVisualizationResponse | undefined,
  result: SearchResult,
): SelectedNode {
  const root = (result.treemapView === "flow" ? undefined : data?.treemaps[result.treemapView as "events" | "actors"]) as
    TreemapNode<number | string> | undefined;
  if (root) {
    const path = findTreemapPath(root, result);
    if (path && path.length > 0) {
      const matched = path[path.length - 1];
      const value =
        matched.value ?? matched.meta?.opCount ?? result.opCount ?? 0;
      return {
        name: matched.name,
        value: Number(value),
        share: matched.meta?.share ?? 0,
        meta: {
          ...matched.meta,
          type: matched.meta?.type ?? result.nodeType,
          id: matched.meta?.id ?? matched.id ?? result.id ?? result.issuer,
          opCount: Number(value),
          childCount: matched.children?.length ?? matched.meta?.childCount,
          protocol: matched.meta?.protocol ?? result.protocol,
          category: matched.meta?.category ?? result.category,
        },
      };
    }
  }
  return searchResultToSelectedNode(result);
}

function activeTreemapRoot(
  data: ActivityVisualizationResponse | undefined,
  treemapView: TreemapViewId,
  metric: DashboardMetricId,
): TreemapNode | null {
  if (!data || treemapView === "flow") return null;
  const payload =
    metric === "protocol_tvl"
      ? data.treemaps.protocol_tvl
      : metric === "xlm_volume"
        ? data.treemaps[`xlm_${treemapView}` as keyof typeof data.treemaps]
        : metric === "usdc"
          ? data.treemaps[`usdc_${treemapView}` as keyof typeof data.treemaps]
          : metric === "transactions"
            ? data.treemaps[`txn_${treemapView}` as keyof typeof data.treemaps]
            : data.treemaps[treemapView];
  return (payload as TreemapNode | undefined) ?? null;
}

export function DashboardProvider({
  children,
  flowViewEnabled = false,
  snapshot = null,
}: {
  children: React.ReactNode;
  /** Resolved server-side; defaults to off so the treemap stays the default. */
  flowViewEnabled?: boolean;
  /** Frozen research snapshot. Disables live activity queries. */
  snapshot?: ResearchSnapshot | null;
}) {
  const readOnly = snapshot != null;
  const [period, setPeriodState] = useState<Period>(snapshot?.period ?? "1d");
  const [comparePeriod, setComparePeriod] = useState<Period | null>(null);
  const [treemapDiff, setTreemapDiffState] = useState(false);
  const [treemapView, setTreemapViewState] = useState<TreemapViewId>(
    snapshot && snapshot.view !== "flow" ? snapshot.view : "events",
  );
  const [chartView, setChartViewState] = useState<ChartViewId>("treemap");
  const [metric, setMetricState] = useState<DashboardMetricId>("ops");
  const [network, setNetworkState] =
    useState<import("@/lib/network").DashboardNetworkId>("mainnet");
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [activeLevelPath, setActiveLevelPath] = useState<TreemapNode[]>([]);
  const [focusRequest, setFocusRequest] = useState<SearchResult | null>(null);
  const [visualization, setVisualizationState] = useState<"treemap" | "flow">(
    "treemap",
  );
  const [searchQuery, setSearchQueryState] = useState("");
  const [flowMode, setFlowMode] = useState<"graph" | "table">("graph");
  const [egoAddress, setEgoAddress] = useState<string | null>(null);
  const pendingPathSegments = useRef<string[] | null>(null);
  const selectionApplied = useRef(false);
  const [urlReady, setUrlReady] = useState(readOnly);
  const frozen = useMemo(
    () => (snapshot ? materializeSnapshot(snapshot) : null),
    [snapshot],
  );

  useEffect(() => {
    if (!frozen || selectionApplied.current) return;
    selectionApplied.current = true;
    // Deferred so the restore does not cascade synchronously during the
    // effect body (same pattern as the URL-parse effect below).
    queueMicrotask(() => {
      setActiveLevelPath(frozen.path);
      if (frozen.selected) setSelectedNode(frozen.selected);
    });
  }, [frozen]);

  useEffect(() => {
    if (readOnly || typeof window === "undefined") return;
    const parsed = parseDashboardUrlSearch(window.location.search);
    if (parsed.pathSegments && parsed.pathSegments.length > 0) {
      pendingPathSegments.current = parsed.pathSegments;
    }
    // Defer state updates so hydration does not cascade synchronously in the effect body.
    queueMicrotask(() => {
      if (new URLSearchParams(window.location.search).get("view") === "flow") {
        setVisualizationState("flow");
      }
      if (parsed.period) setPeriodState(parsed.period);
      if (parsed.comparePeriod) setComparePeriod(parsed.comparePeriod);
      if (parsed.treemapDiff) setTreemapDiffState(true);
      if (parsed.metric) setMetricState(parsed.metric);
      if (parsed.view) setTreemapViewState(parsed.view);
      if (parsed.chartView === "flow" && flowViewEnabled) {
        setChartViewState("flow");
      }
      if (parsed.network) setNetworkState(parsed.network);
      if (parsed.flowMode) setFlowMode(parsed.flowMode);
      if (parsed.egoAddress) setEgoAddress(parsed.egoAddress);
      const query = new URLSearchParams(window.location.search).get("q");
      if (query) setSearchQueryState(query);
      setUrlReady(true);
    });
  }, [flowViewEnabled, readOnly]);

  const handleSetPeriod = useCallback((newPeriod: Period) => {
    if (readOnly) return;
    setSelectedNode(null);
    setActiveLevelPath([]);
    setFocusRequest(null);
    pendingPathSegments.current = null;
    setPeriodState(newPeriod);
  }, [readOnly]);

  const handleSetTreemapView = useCallback((newView: TreemapViewId) => {
    if (readOnly) return;
    setVisualizationState("treemap");
    setSelectedNode(null);
    setActiveLevelPath([]);
    setFocusRequest(null);
    pendingPathSegments.current = null;
    // Picking a treemap sub-view always returns to the treemap chart view.
    setChartViewState("treemap");
    setTreemapViewState(newView);
  }, [readOnly]);

  const handleSetChartView = useCallback((newView: ChartViewId) => {
    if (readOnly) return;
    setSelectedNode(null);
    setActiveLevelPath([]);
    setFocusRequest(null);
    pendingPathSegments.current = null;
    setChartViewState(newView);
  }, [readOnly]);

  const handleSetMetric = useCallback((newMetric: DashboardMetricId) => {
    if (readOnly) return;
    setSelectedNode(null);
    setActiveLevelPath([]);
    setFocusRequest(null);
    pendingPathSegments.current = null;
    setMetricState(newMetric);
  }, [readOnly]);

  const handleSetComparePeriod = useCallback((next: Period | null) => {
    if (readOnly) return;
    setComparePeriod(next);
  }, [readOnly]);

  const handleSetTreemapDiff = useCallback(
    (enabled: boolean) => {
      if (readOnly) return;
      setTreemapDiffState(enabled);
    },
    [readOnly],
  );

  const handleSetNetwork = useCallback(
    (next: import("@/lib/network").DashboardNetworkId) => {
      if (readOnly) return;
      setSelectedNode(null);
      setActiveLevelPath([]);
      setFocusRequest(null);
      pendingPathSegments.current = null;
      setNetworkState(next);
    },
    [readOnly],
  );

  const query = useQuery({
    queryKey: ["activity", period, network],
    queryFn: () => fetchActivity(period, network),
    enabled: urlReady && !readOnly,
    staleTime: 60_000,
  });

  const comparisonQuery = useQuery({
    queryKey: ["activity", comparePeriod, network],
    queryFn: () => fetchActivity(comparePeriod as Period, network),
    enabled: urlReady && comparePeriod !== null && !readOnly,
    staleTime: 60_000,
  });

  // Previous equal-length window backing the treemap diff overlay (#447).
  // Protocol TVL is excluded: adapters report a current snapshot, so a
  // "previous" fetch would return today's values and every tile would read
  // as flat.
  const diffEnabled =
    urlReady && !readOnly && treemapDiff && metric !== "protocol_tvl";
  const previousQuery = useQuery({
    queryKey: ["activity", period, network, "previous-window"],
    queryFn: () => fetchActivity(period, network, "prev"),
    enabled: diffEnabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    const segments = pendingPathSegments.current;
    if (!segments || segments.length === 0 || !query.data) return;
    const root = activeTreemapRoot(query.data, treemapView, metric);
    if (!root) return;
    const resolved = resolveDrillPath(root, segments);
    pendingPathSegments.current = null;
    setActiveLevelPath(resolved);
  }, [query.data, treemapView, metric]);

  useEffect(() => {
    if (!urlReady || readOnly || typeof window === "undefined") return;
    let next = writeDashboardUrlSearch({
      period,
      metric,
      view: treemapView,
      chartView,
      path: activeLevelPath,
      searchQuery,
      currentSearch: window.location.search,
      comparePeriod,
      network,
      flowMode,
      egoAddress,
      treemapDiff,
    });
    if (visualization === "flow") {
      const params = new URLSearchParams(next);
      params.set("view", "flow");
      next = `?${params.toString()}`;
    }
    if (next !== window.location.search) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${next}`,
      );
    }
  }, [urlReady, period, metric, treemapView, chartView, visualization, searchQuery, activeLevelPath, comparePeriod, network, flowMode, egoAddress, treemapDiff]);

  const selectSearchResult = useCallback(
    (result: SearchResult) => {
      // Search results always point at treemap nodes, so return to Treemap.
      setChartViewState("treemap");
      setTreemapViewState(result.treemapView);
      setFocusRequest(result);
      setSelectedNode(selectedNodeFromSearch(query.data, result));
    },
    [query.data],
  );

  const focusWatchedEntity = useCallback(
    (node: SelectedNode) => {
      const address = node.meta?.id ?? null;
      setSelectedNode(node);
      if (flowViewEnabled && address) {
        setChartViewState("flow");
        setVisualizationState("flow");
        setEgoAddress(address);
      }
    },
    [flowViewEnabled],
  );

  const value = useMemo(
    () => ({
      visualization,
      setVisualization: (view: "treemap" | "flow") => {
        if (readOnly) return;
        setVisualizationState(view);
      },
      period,
      setPeriod: handleSetPeriod,
      comparePeriod,
      setComparePeriod: handleSetComparePeriod,
      comparisonData: comparisonQuery.data,
      comparisonLoading:
        comparisonQuery.isLoading || comparisonQuery.isFetching,
      comparisonError: comparisonQuery.error,
      treemapDiff,
      setTreemapDiff: handleSetTreemapDiff,
      previousData: previousQuery.data,
      previousLoading: previousQuery.isLoading || previousQuery.isFetching,
      previousError: previousQuery.error,
      treemapView,
      setTreemapView: handleSetTreemapView,
      chartView,
      setChartView: handleSetChartView,
      flowViewEnabled,
      metric,
      setMetric: handleSetMetric,
      network,
      setNetwork: handleSetNetwork,
      data: readOnly ? frozen?.data : query.data,
      isLoading: readOnly ? false : query.isLoading,
      isError: readOnly ? false : query.isError,
      isFetching: readOnly ? false : query.isFetching,
      error: readOnly ? null : query.error,
      refetch: readOnly ? async () => frozen?.data : query.refetch,
      selectedNode,
      setSelectedNode,
      focusWatchedEntity,
      activeLevelPath,
      setActiveLevelPath,
      focusRequest,
      searchQuery,
      setSearchQuery: (query: string) => {
        if (readOnly) return;
        setSearchQueryState(query);
      },
      selectSearchResult,
      flowMode,
      setFlowMode,
      egoAddress,
      setEgoAddress,
      readOnly,
      snapshot,
    }),
    [
      visualization,
      period,
      comparePeriod,
      comparisonQuery.data,
      comparisonQuery.isLoading,
      comparisonQuery.isFetching,
      comparisonQuery.error,
      handleSetPeriod,
      treemapView,
      handleSetTreemapView,
      chartView,
      handleSetChartView,
      flowViewEnabled,
      metric,
      handleSetMetric,
      network,
      handleSetNetwork,
      query.data,
      query.isLoading,
      query.isError,
      query.isFetching,
      query.error,
      query.refetch,
      selectedNode,
      focusWatchedEntity,
      activeLevelPath,
      focusRequest,
      searchQuery,
      selectSearchResult,
      flowMode,
      egoAddress,
      readOnly,
      frozen,
      handleSetComparePeriod,
      handleSetTreemapDiff,
      treemapDiff,
      previousQuery.data,
      previousQuery.isLoading,
      previousQuery.isFetching,
      previousQuery.error,
      snapshot,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}
