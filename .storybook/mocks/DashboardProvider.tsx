import { createContext, useContext, useMemo, useState } from "react";
import { getMockLoadedActivity } from "@/lib/hubble/fixtures";
import type { useDashboard as realUseDashboard } from "../../components/dashboard/DashboardProvider";

/**
 * Fixture-only stand-in for `components/dashboard/DashboardProvider`.
 *
 * `.storybook/main.ts` redirects every import of the real module here, so
 * components call the same `useDashboard()` hook without triggering the
 * provider's network queries.
 */
export type DashboardValue = ReturnType<typeof realUseDashboard>;

const NO_OVERRIDES: Partial<DashboardValue> = {};

const noop = () => undefined;

const MockDashboardContext = createContext<DashboardValue | null>(null);

export function MockDashboardProvider({
  overrides = NO_OVERRIDES,
  children,
}: {
  overrides?: Partial<DashboardValue>;
  children: React.ReactNode;
}) {
  // Controls that the stories exercise stay interactive via local state.
  const [period, setPeriod] = useState(overrides.period ?? "1d");
  const [comparePeriod, setComparePeriod] = useState(
    overrides.comparePeriod ?? null,
  );
  const [metric, setMetric] = useState(overrides.metric ?? "ops");
  const [selectedNode, setSelectedNode] = useState(
    overrides.selectedNode ?? null,
  );
  const [flowMode, setFlowMode] = useState(overrides.flowMode ?? "graph");

  const value = useMemo(
    () =>
      ({
        visualization: "treemap",
        setVisualization: noop,
        comparisonLoading: false,
        comparisonError: null,
        treemapDiff: false,
        setTreemapDiff: noop,
        previousLoading: false,
        previousError: null,
        treemapView: "events",
        setTreemapView: noop,
        chartView: "treemap",
        setChartView: noop,
        flowViewEnabled: true,
        network: "mainnet",
        setNetwork: noop,
        data: getMockLoadedActivity(),
        isLoading: false,
        isError: false,
        isFetching: false,
        error: null,
        refetch: () => Promise.resolve(),
        focusWatchedEntity: noop,
        activeLevelPath: [],
        setActiveLevelPath: noop,
        focusRequest: null,
        searchQuery: "",
        setSearchQuery: noop,
        selectSearchResult: noop,
        egoAddress: null,
        setEgoAddress: noop,
        readOnly: false,
        snapshot: null,
        ...overrides,
        period,
        setPeriod,
        comparePeriod,
        setComparePeriod,
        metric,
        setMetric,
        selectedNode,
        setSelectedNode,
        flowMode,
        setFlowMode,
        // `FlowView` reads `flowView`/`setFlowView`, so mirror the flow mode.
        flowView: flowMode,
        setFlowView: setFlowMode,
      }) as unknown as DashboardValue,
    [overrides, period, comparePeriod, metric, selectedNode, flowMode],
  );

  return (
    <MockDashboardContext.Provider value={value}>
      {children}
    </MockDashboardContext.Provider>
  );
}

export function useDashboard(): DashboardValue {
  const context = useContext(MockDashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within MockDashboardProvider");
  }
  return context;
}
