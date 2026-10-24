import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  getByTestId,
  queryByTestId,
} from "@testing-library/dom";
import { vi } from "vitest";

/**
 * Issue #305 — production error hierarchy.
 *
 * The dashboard's KPIs, treemap, time series, and heatmaps are all fed by the
 * shared `/api/v1/activity` request, while charts such as category share load
 * independently. These tests mock an activity failure alongside a secondary
 * chart success and assert the UI explains the split, avoids credential hints,
 * and routes Retry at the failed activity query.
 */

const dashboard = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock("@/components/dashboard/DashboardProvider", () => ({
  useDashboard: () => dashboard.state,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AreaChart: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Area: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

import { ActivityErrorBanner } from "./ActivityErrorState";
import { KpiCards } from "./KpiCards";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { CategoryShareChart } from "./CategoryShareChart";

let container: HTMLDivElement;
let root: Root;

function setActivityError(refetch = vi.fn().mockResolvedValue(undefined)) {
  dashboard.state = {
    data: undefined,
    isLoading: false,
    isError: true,
    isFetching: false,
    error: new Error("An unexpected error occurred. Please try again later."),
    refetch,
    period: "1d",
    metric: "ops",
  };
  return { refetch };
}

function setActivitySuccess() {
  const refetch = vi.fn().mockResolvedValue(undefined);
  dashboard.state = {
    data: {},
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch,
    period: "1d",
    metric: "ops",
  };
  return { refetch };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("activity error hierarchy (#305)", () => {
  it("announces the primary failure and that independent charts may still be live", () => {
    setActivityError();
    act(() => root.render(<ActivityErrorBanner />));

    const banner = getByTestId(container, "activity-error-banner");
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner.textContent).toContain("KPIs, the treemap, time series, and heatmaps");
    expect(banner.textContent).toMatch(/may still be live/);
  });

  it("retries the failed activity query, not a secondary chart", async () => {
    const { refetch } = setActivityError();
    act(() => root.render(<ActivityErrorBanner />));

    await act(async () => {
      fireEvent.click(getByTestId(container, "activity-retry"));
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders no banner when the activity query succeeds", () => {
    setActivitySuccess();
    act(() => root.render(<ActivityErrorBanner />));

    expect(queryByTestId(container, "activity-error-banner")).toBeNull();
  });

  it("KPIs surface an explicit error instead of endless skeletons", () => {
    setActivityError();
    act(() => root.render(<KpiCards />));

    expect(getByTestId(container, "kpi-error")).toBeTruthy();
    expect(container.textContent).toContain("KPI cards unavailable");
    expect(getByTestId(container, "kpi-retry")).toBeTruthy();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("time-series failure omits credential hints and links to the shared request", () => {
    setActivityError();
    act(() => root.render(<TimeSeriesChart />));

    const error = getByTestId(container, "timeseries-error");
    expect(error.textContent).not.toContain("GOOGLE_APPLICATION_CREDENTIALS");
    expect(error.textContent).toMatch(/may still be live/);
    expect(getByTestId(container, "timeseries-retry")).toBeTruthy();
  });

  it("keeps the independently loaded category-share chart live and marks it as independent", async () => {
    setActivityError();

    const response = {
      period: "1d",
      granularity: "hour",
      timezone: "UTC",
      start: "2026-09-29T00:00:00.000Z",
      end: "2026-09-29T23:59:59.999Z",
      source: "fixture",
      buckets: [
        {
          bucketStart: "2026-09-29T00:00:00.000Z",
          bucketEnd: "2026-09-29T01:00:00.000Z",
          partial: false,
          total: 10,
          categories: {
            soroban: 10,
            payments: 0,
            dex: 0,
            liquidity_pools: 0,
            claimable_balances: 0,
            trustlines: 0,
            account: 0,
            other: 0,
          },
        },
      ],
      legend: [
        { id: "soroban", label: "Soroban", color: "#7B61FF" },
        { id: "payments", label: "Payments", color: "#14B8A6" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => response,
    } as Response);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <CategoryShareChart />
        </QueryClientProvider>,
      );
    });
    await flush();

    expect(getByTestId(container, "category-share-independent")).toBeTruthy();
    expect(
      container.querySelector('[data-testid="category-share-independent"]')
        ?.textContent,
    ).toMatch(/separate request and is still live/);
  });
});
