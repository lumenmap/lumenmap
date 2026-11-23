import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { useDashboard } from "./DashboardProvider";
import { DetailPanel } from "./DetailPanel";

vi.mock("./DashboardProvider", () => ({ useDashboard: vi.fn() }));

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  container.remove();
});

test("a fixture contract states its invoke success rate in text", async () => {
  vi.mocked(useDashboard).mockReturnValue({
    selectedNode: {
      name: "Example contract",
      value: 100,
      share: 0.2,
      meta: {
        type: "contract",
        id: "C" + "A".repeat(55),
        successfulInvokes: 80,
        failedInvokes: 20,
      },
    },
    setSelectedNode: vi.fn(),
    setTreemapView: vi.fn(),
    setActiveLevelPath: vi.fn(),
    network: "mainnet",
    readOnly: true,
    metric: "ops",
    isLoading: false,
    data: { period: "7d", treemaps: { events: [] } },
  } as unknown as ReturnType<typeof useDashboard>);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <DetailPanel />
      </QueryClientProvider>,
    );
  });
  expect(container.textContent).toContain("80 of 100 invokes succeeded (80.0%). 20 failed.");
});
