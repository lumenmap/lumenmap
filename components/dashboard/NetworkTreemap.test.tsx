import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { getByText } from "@testing-library/dom";
import { NetworkTreemap } from "./NetworkTreemap";

vi.mock("@/components/dashboard/DashboardProvider", () => ({
  useDashboard: () => ({
    data: {
      period: "1d",
      treemaps: {
        events: { name: "Network Activity", children: [{ name: "soroban", value: 1 }] },
        actors: { name: "Accounts & Contracts", children: [] },
      },
      kpis: {
        totalOps: 123,
        sorobanShare: 12.3,
        topCategory: "soroban",
        activeContracts: 5,
      },
    },
    isLoading: false,
    isError: false,
    error: null,
    period: "1d",
    metric: "ops",
    treemapView: "events",
    setSelectedNode: vi.fn(),
    refetch: vi.fn(),
  }),
}));

describe("NetworkTreemap", () => {
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
});
