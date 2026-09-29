import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getAllByRole, getByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TreemapMetricSelector } from "./TreemapMetricSelector";

const useDashboard = vi.hoisted(() => vi.fn());

vi.mock("@/components/dashboard/DashboardProvider", () => ({
  useDashboard: () => useDashboard(),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function render(metric: string) {
  useDashboard.mockReturnValue({
    metric,
    setMetric: vi.fn(),
    data: undefined,
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<TreemapMetricSelector />);
  });
  roots.push(root);
  return container;
}

describe("TreemapMetricSelector", () => {
  it("exposes the selected metric as a pressed toggle", () => {
    const container = render("usdc");

    const group = getByRole(container, "group", { name: "Treemap metric" });
    const buttons = getAllByRole(group, "button");

    const pressed = buttons.filter(
      (button) => button.getAttribute("aria-pressed") === "true",
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toBe("USDC Volume");

    for (const button of buttons) {
      if (button !== pressed[0]) {
        expect(button.getAttribute("aria-pressed")).toBe("false");
      }
    }
  });

  it("marks the selected control with the accessible filled variant", () => {
    const container = render("ops");
    const selected = getByRole(container, "button", { name: "Operation Count" });
    const unselected = getByRole(container, "button", { name: "XLM Volume" });

    expect(selected.className).toContain("bg-surface-accent-strong");
    expect(unselected.className).toContain("border-border");
    expect(unselected.className).not.toContain("bg-surface-accent-strong");
  });

  it("renders the metric description with a role that meets AA contrast", () => {
    const container = render("ops");
    const description = container.querySelector("p");

    // text-text-muted (#8d8e98) is 5.71:1 on the canvas; text-zinc-500 was 3.84:1.
    expect(description?.className).toContain("text-text-muted");
    expect(description?.className).not.toContain("text-zinc-500");
  });
});
