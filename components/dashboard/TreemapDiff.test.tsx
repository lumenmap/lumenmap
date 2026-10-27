import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent } from "@testing-library/dom";

import { TreemapDataTable } from "./TreemapDataTable";
import { TreemapDiffLegend } from "./TreemapDiffLegend";
import { TreemapDiffToggle } from "./TreemapDiffToggle";
import {
  TREEMAP_DIFF_BUCKET_COLORS,
  calculateTreemapDelta,
} from "@/lib/treemap-diff";
import type { TreemapNode } from "@/lib/types";

function render(el: React.ReactElement): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(el);
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLDivElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

const ROWS: TreemapNode[] = [
  { name: "Payment", id: "payment", value: 125, meta: { type: "entity", id: "payment", opCount: 125 } },
  { name: "Swap", id: "swap", value: 80, meta: { type: "entity", id: "swap", opCount: 80 } },
  { name: "Transfer", id: "transfer", value: 55, meta: { type: "entity", id: "transfer", opCount: 55 } },
];

const DROPPED: TreemapNode = {
  name: "Offer",
  id: "offer",
  value: 50,
  meta: { type: "entity", id: "offer", opCount: 50 },
};

function buildDiff() {
  const deltas = new Map<string, ReturnType<typeof calculateTreemapDelta>>([
    ["payment", calculateTreemapDelta("payment", 125, 100)],
    ["swap", calculateTreemapDelta("swap", 80, 100)],
    ["transfer", calculateTreemapDelta("transfer", 55, 0)],
    ["offer", calculateTreemapDelta("offer", 0, 50)],
  ]);
  return { deltas, dropped: [DROPPED], parentPathKey: "" };
}

function deltaCellFor(container: HTMLElement, kind: string): HTMLElement | null {
  return (
    Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="treemap-delta-cell"]'),
    ).find((cell) => cell.dataset.diffKind === kind) ?? null
  );
}

describe("TreemapDataTable diff overlay", () => {
  it("hides the delta column when no diff is provided", () => {
    const { container, root } = render(
      <TreemapDataTable
        levelName="Soroban"
        nodes={ROWS}
        levelTotal={260}
        selectedNode={null}
        onSelect={vi.fn()}
      />,
    );

    try {
      expect(container.textContent).not.toContain("Δ vs prev");
      expect(
        container.querySelectorAll('[data-testid="treemap-delta-cell"]'),
      ).toHaveLength(0);
    } finally {
      cleanup(root, container);
    }
  });

  it("shows the delta column with signed text and icons for growth and decline", () => {
    const { container, root } = render(
      <TreemapDataTable
        levelName="Soroban"
        nodes={ROWS}
        levelTotal={260}
        selectedNode={null}
        onSelect={vi.fn()}
        diff={buildDiff()}
      />,
    );

    try {
      expect(container.textContent).toContain("Δ vs prev");

      const cells = container.querySelectorAll(
        '[data-testid="treemap-delta-cell"]',
      );
      // grew + declined + new rows (the dropped row is tested separately).
      expect(cells.length).toBeGreaterThanOrEqual(3);

      const grew = deltaCellFor(container, "grew");
      expect(grew?.textContent).toContain("+25");
      expect(grew?.textContent).toContain("(+25.0%)");
      expect(grew?.querySelector("svg")).not.toBeNull();

      const declined = deltaCellFor(container, "declined");
      expect(declined?.textContent).toContain("-20");
      expect(declined?.textContent).toContain("(-20.0%)");
      expect(declined?.querySelector("svg")).not.toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it("marks new rows with a New badge instead of a percent", () => {
    const { container, root } = render(
      <TreemapDataTable
        levelName="Soroban"
        nodes={ROWS}
        levelTotal={260}
        selectedNode={null}
        onSelect={vi.fn()}
        diff={buildDiff()}
      />,
    );

    try {
      const row = Array.from(container.querySelectorAll("tr")).find((tr) =>
        tr.textContent?.includes("Transfer"),
      );
      expect(row?.textContent).toContain("New");
      expect(row?.textContent).toContain("+55 (new)");
    } finally {
      cleanup(root, container);
    }
  });

  it("appends dropped rows with a Dropped badge and -100% delta", () => {
    const { container, root } = render(
      <TreemapDataTable
        levelName="Soroban"
        nodes={ROWS}
        levelTotal={260}
        selectedNode={null}
        onSelect={vi.fn()}
        diff={buildDiff()}
      />,
    );

    try {
      const droppedRow = container.querySelector<HTMLElement>(
        '[data-testid="treemap-dropped-row"]',
      );
      expect(droppedRow).not.toBeNull();
      expect(droppedRow?.textContent).toContain("Offer");
      expect(droppedRow?.textContent).toContain("Dropped");
      expect(droppedRow?.textContent).toContain("50");
      expect(droppedRow?.textContent).toContain("(-100.0%)");
      expect(droppedRow?.querySelector('[data-diff-kind="dropped"]')).not.toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it("sorts by delta when the delta header is activated", () => {
    const { container, root } = render(
      <TreemapDataTable
        levelName="Soroban"
        nodes={ROWS}
        levelTotal={260}
        selectedNode={null}
        onSelect={vi.fn()}
        diff={buildDiff()}
      />,
    );

    try {
      const deltaHeader = Array.from(
        container.querySelectorAll("th button"),
      ).find((button) => button.textContent?.includes("Δ vs prev"));
      expect(deltaHeader).toBeTruthy();

      act(() => {
        fireEvent.click(deltaHeader as HTMLButtonElement);
      });

      // Descending: new (+∞) first, then +25%, then −20%.
      const rowText = Array.from(
        container.querySelectorAll("tbody tr"),
      ).map((tr) => tr.textContent ?? "");
      expect(rowText[0]).toContain("Transfer");
      expect(rowText[1]).toContain("Payment");
      expect(rowText[2]).toContain("Swap");
      // The dropped row stays pinned after the sortable rows.
      expect(rowText[3]).toContain("Offer");
    } finally {
      cleanup(root, container);
    }
  });
});

describe("TreemapDiffLegend", () => {
  it("documents every color bucket and the dropped-tile handling in text", () => {
    const { container, root } = render(<TreemapDiffLegend />);

    try {
      const group = container.querySelector('[role="group"]');
      expect(group?.getAttribute("aria-label")).toBe(
        "Change versus previous window legend",
      );

      for (const label of [
        "New (no previous activity)",
        "Growth ≥ +50%",
        "Growth +10% to +50%",
        "Flat within ±10%",
        "Decline −10% to −50%",
        "Decline ≤ −50%",
      ]) {
        expect(container.textContent).toContain(label);
      }

      // Dropped tiles are explained, since they have no tile at all.
      expect(container.textContent).toContain("Dropped");

      // Every bucket color appears as a swatch fill.
      const fills = Array.from(
        container.querySelectorAll("svg rect"),
      ).map((rect) => rect.getAttribute("fill"));
      for (const color of Object.values(TREEMAP_DIFF_BUCKET_COLORS)) {
        expect(fills).toContain(color);
      }
    } finally {
      cleanup(root, container);
    }
  });
});

const dashboardMock = vi.hoisted(() => ({
  state: {
    treemapDiff: false,
    metric: "ops" as string,
    setTreemapDiff: vi.fn(),
  },
}));

vi.mock("@/components/dashboard/DashboardProvider", () => ({
  useDashboard: () => dashboardMock.state,
}));

describe("TreemapDiffToggle", () => {
  beforeEach(() => {
    dashboardMock.state.setTreemapDiff.mockClear();
    dashboardMock.state.treemapDiff = false;
    dashboardMock.state.metric = "ops";
  });

  it("toggles the diff overlay on click and reflects state via aria-pressed", () => {
    const { container, root } = render(<TreemapDiffToggle />);

    try {
      const query = () =>
        container.querySelector<HTMLButtonElement>(
          '[data-testid="treemap-diff-toggle"]',
        );

      expect(query()).not.toBeNull();
      expect(query()?.getAttribute("aria-pressed")).toBe("false");

      dashboardMock.state.treemapDiff = true;
      act(() => {
        root.render(<TreemapDiffToggle />);
      });
      expect(query()?.getAttribute("aria-pressed")).toBe("true");

      act(() => {
        fireEvent.click(query() as HTMLButtonElement);
      });
      expect(dashboardMock.state.setTreemapDiff).toHaveBeenCalledWith(false);
    } finally {
      cleanup(root, container);
    }
  });

  it("is disabled for protocol TVL with an explanation", () => {
    dashboardMock.state.metric = "protocol_tvl";
    const { container, root } = render(<TreemapDiffToggle />);

    try {
      const button = container.querySelector<HTMLButtonElement>(
        '[data-testid="treemap-diff-toggle"]',
      );
      expect(button?.disabled).toBe(true);
      expect(button?.getAttribute("title")).toContain("protocol TVL");
    } finally {
      cleanup(root, container);
    }
  });
});
