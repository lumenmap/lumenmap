import { act } from "react";
import { createRoot } from "react-dom/client";
import { getByTestId } from "@testing-library/dom";
import { ClassicDefiActivity } from "./ClassicDefiActivity";

const { mockUseDashboard } = vi.hoisted(() => ({
  mockUseDashboard: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardProvider", () => ({
  useDashboard: mockUseDashboard,
}));

const breakdowns = {
  liquidityPools: {
    scope: "liquidity_pools" as const,
    totalOps: 250,
    rows: [
      {
        accountId: "GADEPOSITORSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ops: 150,
        scopeShare: 60,
        byType: [
          { type_string: "liquidity_pool_deposit", ops: 100 },
          { type_string: "liquidity_pool_withdraw", ops: 50 },
        ],
      },
    ],
    distinctAccounts: 1,
    truncated: false,
  },
  claimableBalances: {
    scope: "claimable_balances" as const,
    totalOps: 40,
    rows: [
      {
        accountId: "GACREATORSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ops: 40,
        scopeShare: 100,
        byType: [{ type_string: "create_claimable_balance", ops: 40 }],
      },
    ],
    distinctAccounts: 1,
    truncated: false,
  },
};

function renderPanel() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ClassicDefiActivity />);
  });
  return { container, root };
}

describe("ClassicDefiActivity", () => {
  it("ranks accounts per category with per-type counts and share", () => {
    mockUseDashboard.mockReturnValue({
      data: { classicDeFi: breakdowns },
      isLoading: false,
    });
    const { container, root } = renderPanel();

    try {
      const panel = getByTestId(container, "classic-defi-activity");
      expect(panel.textContent).toContain("150");
      expect(panel.textContent).toContain("60%");
      expect(panel.textContent).toContain("liquidity pool deposit");
      expect(panel.textContent).toContain("250 operations across 1 accounts");
      expect(panel.textContent).toContain("40 operations across 1 accounts");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("says so instead of rendering zeros when the response has no breakdown", () => {
    mockUseDashboard.mockReturnValue({
      data: { kpis: {} },
      isLoading: false,
    });
    const { container, root } = renderPanel();

    try {
      const panel = getByTestId(container, "classic-defi-activity");
      expect(panel.textContent).toContain("unavailable");
      expect(container.querySelectorAll("table").length).toBe(0);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("shows placeholders while the activity response is loading", () => {
    mockUseDashboard.mockReturnValue({ data: undefined, isLoading: true });
    const { container, root } = renderPanel();

    try {
      expect(container.querySelectorAll('[class*="animate-pulse"]').length)
        .toBeGreaterThan(0);
      expect(container.querySelectorAll("table").length).toBe(0);
      expect(container.textContent).not.toContain("unavailable");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
