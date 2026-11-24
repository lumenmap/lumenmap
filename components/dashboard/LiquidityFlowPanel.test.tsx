import { act } from "react";
import { createRoot } from "react-dom/client";
import { getByTestId } from "@testing-library/dom";
import { getFixtureActivityData } from "@/lib/fixtures/activity";
import { buildLiquidityFlowSplit } from "@/lib/metrics/liquidity-flow";
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
  it("renders the fixture liquidity-flow summary with all split buckets", () => {
    const fixture = getFixtureActivityData("1d");
    mockUseDashboard.mockReturnValue({
      data: { liquidityFlow: fixture.liquidityFlow },
      period: "1d",
      isLoading: false,
    });
    const { container, root } = renderPanel();

    try {
      const panel = getByTestId(container, "liquidity-flow-panel");
      expect(panel.textContent).toContain("Path payments");
      expect(panel.textContent).toContain("43.0K");
      expect(panel.textContent).toContain("165.0K");
      expect(panel.textContent).toContain("21.4K XLM");
      expect(panel.textContent).toContain("62.0K USDC");
      expect(panel.textContent).toContain("USDC");
      expect(panel.textContent).toContain("AQUA");
      expect(panel.textContent).toContain("Manage offers");
      expect(panel.textContent).toContain("Related (liquidity pools)");
      expect(panel.textContent).toContain("create passive sell offer");
      expect(getByTestId(container, "liquidity-flow-split-table")).toBeTruthy();
      expect(getByTestId(container, "liquidity-flow-split-bar")).toBeTruthy();
      expect(
        getByTestId(container, "liquidity-flow-split-bar").getAttribute(
          "aria-label",
        ) ||
          getByTestId(container, "liquidity-flow-split-bar").querySelector(
            '[role="img"]',
          )?.getAttribute("aria-label"),
      ).toMatch(/Manage offers/);
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
          split: buildLiquidityFlowSplit([
            { type_string: "path_payment_strict_send", op_count: 2 },
          ]),
        },
      },
      period: "1d",
      isLoading: false,
    });
    const { container, root } = renderPanel();

    try {
      expect(getByTestId(container, "liquidity-flow-panel").textContent).toContain(
        "Route asset details are unavailable",
      );
      expect(container.textContent).toContain("Unavailable");
      expect(container.textContent).toContain("Missing subtypes soft-failed");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
