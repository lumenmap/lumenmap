import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent } from "@testing-library/dom";
import { vi } from "vitest";
import { DetailPanelContainer } from "./DetailPanelContainer";

const state = vi.hoisted(() => ({
  selectedNode: { name: "Soroban", value: 10, share: 0.5, meta: { nodeId: "soroban" } },
  setSelectedNode: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardProvider", () => ({ useDashboard: () => state }));
vi.mock("@/components/dashboard/DetailPanel", () => ({
  DetailPanel: ({ onClose }: { onClose: () => void }) => (
    <div><button onClick={onClose}>Close details</button><a href="#details">Details link</a></div>
  ),
}));

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;

function mount(mobile: boolean, reducedMotion = true) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("max-width") ? mobile : reducedMotion,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  act(() => root.render(<DetailPanelContainer />));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  trigger = document.createElement("button");
  trigger.id = "node-soroban";
  document.body.appendChild(trigger);
  trigger.focus();
  state.setSelectedNode.mockClear();
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  trigger.remove();
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

test("mobile details is a modal with focus trap, Escape, and focus restoration", () => {
  mount(true);
  const sheet = container.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(sheet.getAttribute("aria-modal")).toBe("true");
  expect(sheet.getAttribute("aria-label")).toBe("Details: Soroban");
  expect(container.querySelector(`#${sheet.getAttribute("aria-describedby")}`)?.textContent).toContain("press Escape");
  expect(document.activeElement).toBe(sheet);
  expect(document.body.style.overflow).toBe("hidden");

  act(() => fireEvent.keyDown(document, { key: "Tab", shiftKey: true }));
  expect(document.activeElement).toBe(sheet.querySelector("a"));
  act(() => fireEvent.keyDown(document, { key: "Tab" }));
  expect(document.activeElement).toBe(sheet.querySelector("button"));

  act(() => fireEvent.keyDown(document, { key: "Escape" }));
  expect(state.setSelectedNode).toHaveBeenCalledWith(null);
  act(() => root.render(null));
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe("");
});

test("desktop keeps details inline without modal behavior", () => {
  mount(false);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.style.overflow).toBe("");
  expect(document.activeElement).toBe(trigger);
  act(() => fireEvent.click(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Close details")!));
  expect(state.setSelectedNode).toHaveBeenCalledWith(null);
});

test("mobile swipe handle dismisses the sheet when motion is reduced", () => {
  mount(true, true);
  const handle = container.querySelector<HTMLElement>('button[aria-label="Dismiss details"]')!;
  act(() => {
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 180 }] });
  });
  expect(state.setSelectedNode).toHaveBeenCalledWith(null);
});

test("mobile close waits for the exit motion when motion is allowed", () => {
  vi.useFakeTimers();
  try {
    mount(true, false);
    act(() => fireEvent.click(container.querySelector('button[aria-label="Dismiss details"]')!));
    expect(state.setSelectedNode).not.toHaveBeenCalled();
    expect(container.querySelector(".detail-sheet-out")).not.toBeNull();
    act(() => vi.advanceTimersByTime(180));
    expect(state.setSelectedNode).toHaveBeenCalledWith(null);
  } finally {
    vi.useRealTimers();
  }
});
