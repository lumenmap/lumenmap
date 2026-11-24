import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/dom";
import { vi } from "vitest";
import { useDashboard } from "./DashboardProvider";
import { TopCounterparties } from "./TopCounterparties";
import { FIXTURE_ACCOUNTS } from "@/lib/fixtures/raw-data";
import { OVERLAPPING_COUNTERPARTY_FIXTURE_EDGES } from "@/lib/entities/top-counterparties";

vi.mock("./DashboardProvider", () => ({ useDashboard: vi.fn() }));

const accountId = FIXTURE_ACCOUNTS.kraken;
let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
const setSelectedNode = vi.fn();

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setSelectedNode.mockClear();
  vi.mocked(useDashboard).mockReturnValue({
    selectedNode: {
      name: "Kraken",
      value: 10,
      share: 0.1,
      meta: { type: "account", id: accountId },
    },
    setSelectedNode,
    data: { period: "1d" },
    period: "1d",
    network: "mainnet",
    isLoading: false,
  } as unknown as ReturnType<typeof useDashboard>);
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});

test("soft-fails when flow lookup errors without blanking the section", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TopCounterparties />
      </QueryClientProvider>,
    );
  });
  await waitFor(() =>
    expect(container.textContent).toMatch(/Counterparties unavailable/i),
  );
  expect(container.querySelector("[data-testid='top-counterparties']")).toBeTruthy();
});

test("ranks overlapping fixture edges and keeps Expert links keyboard-focusable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sampled: true,
        nodes: [
          { id: FIXTURE_ACCOUNTS.lobstr, label: "LOBSTR", category: "wallet" },
          { id: FIXTURE_ACCOUNTS.moneygram, label: "MoneyGram", category: "anchor" },
        ],
        edges: OVERLAPPING_COUNTERPARTY_FIXTURE_EDGES,
      }),
    })),
  );
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TopCounterparties />
      </QueryClientProvider>,
    );
  });
  await waitFor(() => expect(container.textContent).toContain("LOBSTR"));
  expect(container.textContent).toContain("8 ops");
  expect(container.textContent).toContain("MoneyGram");
  expect(container.querySelector("[data-testid='top-counterparties-sampled']")).toBeTruthy();
  const buttons = container.querySelectorAll("button");
  expect(buttons.length).toBeGreaterThan(0);
  expect(container.querySelector("a[href*='stellar.expert']")).toBeTruthy();
});

test("shows contract empty state without calling flow", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(useDashboard).mockReturnValue({
    selectedNode: {
      name: "Soroswap",
      value: 10,
      share: 0.1,
      meta: {
        type: "contract",
        id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
      },
    },
    setSelectedNode,
    data: { period: "1d" },
    period: "1d",
    network: "mainnet",
    isLoading: false,
  } as unknown as ReturnType<typeof useDashboard>);

  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TopCounterparties />
      </QueryClientProvider>,
    );
  });
  expect(container.textContent).toMatch(/not available for contracts/i);
  expect(fetchMock).not.toHaveBeenCalled();
});
