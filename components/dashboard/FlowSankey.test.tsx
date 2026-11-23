import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent, getAllByRole, getByRole, queryByRole, waitFor } from "@testing-library/dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildFlowGraph } from "@/lib/flow/graph";
import { FIXTURE_FLOW_EDGES } from "@/lib/flow/fixtures";
import { FlowViewSection, FlowVisualization } from "./FlowViewSection";

vi.mock("@/components/dashboard/DashboardProvider", () => ({
  useDashboard: () => ({ period: "1d", network: "mainnet", setSelectedNode: vi.fn() }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  container.remove();
});

const graph = buildFlowGraph(FIXTURE_FLOW_EDGES);

describe("Flow Sankey fixture", () => {
  it("loads fixture payment edges from the Flow API before offering Sankey", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ...graph, period: "1d", account: null, source: "fixture", sampled: false }) }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={client}><FlowViewSection /></QueryClientProvider>));
    await waitFor(() => expect(getByRole(container, "button", { name: "sankey" })).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/flow?period=1d&network=mainnet");
  });

  it("toggles from the Flow canvas, discloses caps, and provides a keyboard node list", () => {
    const onSelect = vi.fn();
    act(() => root.render(<FlowVisualization {...graph} sampled onSelect={onSelect} />));
    expect(getByRole(container, "button", { name: "sankey" }).getAttribute("aria-pressed")).toBe("false");
    act(() => fireEvent.click(getByRole(container, "button", { name: "sankey" })));
    expect(getByRole(container, "button", { name: "sankey" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Top 3 of 3 eligible edges");
    expect(container.textContent).toContain("caps the overview at 100 edges");
    expect(container.textContent).toContain("Static source");
    const scrollRegions = getAllByRole(container, "region", { name: /scroll horizontally/i });
    expect(scrollRegions).toHaveLength(2);
    expect(scrollRegions.every((region) => region.className.includes("overflow-x-auto"))).toBe(true);
    act(() => fireEvent.click(container.querySelector("summary")!));
    const nodeButton = getAllByRole(container, "button", { name: graph.nodes[0].label })[0];
    expect(nodeButton.tabIndex).toBe(0);
    act(() => fireEvent.click(nodeButton));
    expect(onSelect).toHaveBeenCalledWith(graph.nodes[0].id);
  });

  it("hides Sankey when eligible amounts are absent and shows the empty state", () => {
    act(() => root.render(<FlowVisualization nodes={graph.nodes} edges={[{ ...graph.edges[0], amountComplete: false }]} />));
    expect(queryByRole(container, "button", { name: "sankey" })).toBeNull();
    act(() => root.render(<FlowVisualization nodes={[]} edges={[]} />));
    expect(getByRole(container, "status").textContent).toContain("No payment flow edges");
  });
});
