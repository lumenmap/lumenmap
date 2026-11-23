import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, getByRole, getByText } from "@testing-library/dom";
import { NetworkTreemap } from "./NetworkTreemap";

const { setChartViewMock, dashboardState } = vi.hoisted(() => ({
  setChartViewMock: vi.fn(),
  dashboardState: { view: "events", metric: "ops" },
}));

vi.mock("@/components/dashboard/DashboardProvider", () => ({
  useDashboard: () => ({
    data: {
      period: "1d",
      treemaps: {
        events: {
          name: "Network Activity",
          metric: "operation_count",
          unit: "count",
          children: [{ name: "soroban", value: 1, meta: { category: "soroban" } }],
        },
        actors: {
          name: "Accounts & Contracts",
          metric: "operation_count",
          unit: "count",
          children: [
            { name: "Soroban", value: 2, meta: { type: "category", category: "soroban" }, children: [
              { name: "Soroswap", value: 1, meta: { type: "contract", category: "soroban", tag: "dex" } },
              { name: "Infrastructure", value: 1, meta: { type: "contract", category: "soroban", tag: "infra" } },
            ] },
            { name: "Payments", value: 2, meta: { type: "category", category: "payments" }, children: [
              { name: "MoneyGram", value: 1, meta: { type: "account", category: "payments", tag: "anchor" } },
              { name: "Unclassified", value: 1, meta: { type: "account", category: "payments" } },
            ] },
          ],
        },
        txn_events: {
          name: "Network Activity",
          metric: "transaction_count",
          unit: "count",
          children: [],
        },
        txn_actors: {
          name: "Accounts & Contracts",
          metric: "transaction_count",
          unit: "count",
          children: [],
        },
        xlm_events: {
          name: "Network Activity",
          metric: "asset_volume",
          unit: "XLM",
          children: [],
        },
        xlm_actors: {
          name: "Accounts & Contracts",
          metric: "asset_volume",
          unit: "XLM",
          children: [],
        },
        usdc_events: {
          name: "Network Activity",
          metric: "asset_volume",
          unit: "USDC",
          children: [],
        },
        usdc_actors: {
          name: "Accounts & Contracts",
          metric: "asset_volume",
          unit: "USDC",
          children: [],
        },
        protocol_tvl: {
          name: "Protocol TVL",
          metric: "tvl",
          unit: "USD",
          children: [
            { name: "Soroswap", value: 10, meta: { type: "protocol", tag: "dex" } },
            { name: "MoneyGram", value: 20, meta: { type: "protocol", tag: "anchor" } },
          ],
        },
      },
      kpis: {
        totalOps: { kind: "operations", unit: "ops", value: 123 },
        sorobanShare: { kind: "share", unit: "percent", value: 12.3 },
        topCategory: "soroban",
        activeContracts: { kind: "entity_count", unit: "count", value: 5 },
        activeWallets: { kind: "entity_count", unit: "count", value: 12 },
        activeDestinationAccounts: { kind: "entity_count", unit: "count", value: 9 },
      },
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    period: "1d",
    metric: dashboardState.metric,
    treemapView: dashboardState.view,
    chartView: "treemap",
    setChartView: setChartViewMock,
    flowViewEnabled: true,
    selectedNode: null,
    setSelectedNode: vi.fn(),
    activeLevelPath: [],
    setActiveLevelPath: vi.fn(),
    focusRequest: null,
    selectSearchResult: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/dashboard/D3Treemap", () => ({
  D3Treemap: ({ root }: { root: { children?: { name: string; children?: { name: string }[] }[] } }) => (
    <div data-testid="d3-treemap">{root.children?.flatMap((node) => node.children?.map((child) => child.name) ?? [node.name]).join(", ")}</div>
  ),
}));

vi.mock("@/components/dashboard/ExportControls", () => ({
  ExportControls: () => null,
}));

vi.mock("@/components/dashboard/TreemapDataTable", () => ({
  TreemapDataTable: ({ nodes }: { nodes: { name: string }[] }) => (
    <div data-testid="treemap-table">{nodes.map((node) => node.name).join(", ")}</div>
  ),
}));

describe("NetworkTreemap", () => {
  afterEach(() => {
    dashboardState.view = "events";
    dashboardState.metric = "ops";
  });

  it("filters actor tiles and table rows by tag, combines category filters, and resets", () => {
    dashboardState.view = "actors";
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<NetworkTreemap />));
      const chart = () => container.querySelector('[data-testid="d3-treemap"]')?.textContent;
      const table = () => container.querySelector('[data-testid="treemap-table"]')?.textContent;
      expect(chart()).toContain("MoneyGram");
      act(() => fireEvent.click(getByRole(container, "button", { name: "DEX protocol tag filter" })));
      expect(chart()).toContain("Soroswap");
      expect(chart()).not.toContain("MoneyGram");
      expect(table()).toBe("Soroban");
      act(() => fireEvent.click(getByRole(container, "button", { name: /Soroban category filter/ })));
      expect(container.textContent).toContain("No entities match these filters.");
      expect(table()).toBe("");
      act(() => fireEvent.click(getByRole(container, "button", { name: "Reset filters" })));
      expect(chart()).toContain("MoneyGram");
      expect(table()).toContain("Payments");
      act(() => fireEvent.click(getByRole(container, "button", { name: "Other protocol tag filter" })));
      expect(chart()).toContain("Unclassified");
      expect(chart()).not.toContain("Soroswap");
    } finally {
      act(() => root.unmount());
      document.body.removeChild(container);
    }
  });

  it("filters Protocol TVL tiles and rows by the same taxonomy", () => {
    dashboardState.metric = "protocol_tvl";
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<NetworkTreemap />));
      act(() => fireEvent.click(getByRole(container, "button", { name: "Anchor protocol tag filter" })));
      expect(container.querySelector('[data-testid="d3-treemap"]')?.textContent).toBe("MoneyGram");
      expect(container.querySelector('[data-testid="treemap-table"]')?.textContent).toBe("MoneyGram");
    } finally {
      act(() => root.unmount());
      document.body.removeChild(container);
    }
  });
  it("renders the legend using semantic token colors", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<NetworkTreemap />);
      });

      const legend = getByText(container, "Soroban");
      expect(legend).toBeTruthy();
    } finally {
      root.unmount();
      document.body.removeChild(container);
    }
  });

  it("offers the Flow chart view beside the treemap controls when enabled", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<NetworkTreemap />);
      });

      expect(
        getByRole(container, "tab", { name: "Treemap" }).getAttribute(
          "aria-selected",
        ),
      ).toBe("true");
      const flowTab = getByRole(container, "tab", { name: "Flow" });
      expect(flowTab.getAttribute("aria-selected")).toBe("false");

      act(() => fireEvent.click(flowTab));
      expect(setChartViewMock).toHaveBeenCalledWith("flow");
    } finally {
      root.unmount();
      document.body.removeChild(container);
    }
  });
});
