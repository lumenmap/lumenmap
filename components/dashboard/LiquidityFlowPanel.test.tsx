import { act } from "react";
import { createRoot } from "react-dom/client";
import { getByTestId } from "@testing-library/dom";
import { getFixtureActivityData } from "@/lib/fixtures/activity";
import { LiquidityFlowPanel } from "./LiquidityFlowPanel";

const { mockUseDashboard } = vi.hoisted(() => ({
  mockUseDashboard: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardProvider", () => ({
  useDashboard: mockUseDashboard,
}));

function renderPanel() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<LiquidityFlowPanel />);
  });
  return { container, root };
}

describe("LiquidityFlowPanel", () => {
  it("renders the fixture liquidity-flow summary", () => {
    const fixture = getFixtureActivityData("1d");
    mockUseDashboard.mockReturnValue({
      data: { liquidityFlow: fixture.liquidityFlow },
      isLoading: false,
    });
    const { container, root } = renderPanel();

    try {
      const panel = getByTestId(container, "liquidity-flow-panel");
      expect(panel.textContent).toContain("Path payments");
      expect(panel.textContent).toContain("43.0K");
      expect(panel.textContent).toContain("160.0K");
      expect(panel.textContent).toContain("21.4K XLM");
      expect(panel.textContent).toContain("62.0K USDC");
      expect(panel.textContent).toContain("USDC");
      expect(panel.textContent).toContain("AQUA");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("states when optional route details are unavailable", () => {
    mockUseDashboard.mockReturnValue({
      data: {
        liquidityFlow: {
          pathPaymentCount: 2,
          dexOperationCount: 0,
          liquidityPoolOperationCount: 0,
          pathPaymentAmounts: null,
          intermediateAssets: [],
          intermediateAssetsAvailable: false,
        },
      },
      isLoading: false,
    });
    const { container, root } = renderPanel();

    try {
      expect(getByTestId(container, "liquidity-flow-panel").textContent).toContain(
        "Route asset details are unavailable",
      );
      expect(container.textContent).toContain("Unavailable");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
