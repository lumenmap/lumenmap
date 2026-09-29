import { act } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";
import { FLOW_FIXTURE } from "@/lib/fixtures/flow";
import { FlowCanvas } from "./FlowCanvas";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("mounts the fixture graph and draws each node and directed edge", () => {
  const arc = vi.fn();
  const lineTo = vi.fn();
  const context = {
    setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo, stroke: vi.fn(), fill: vi.fn(),
    closePath: vi.fn(), arc, fillText: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(520);
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<FlowCanvas nodes={FLOW_FIXTURE.nodes} edges={FLOW_FIXTURE.edges} />));
  const canvas = host.querySelector("canvas");
  expect(canvas?.getAttribute("data-node-count")).toBe(String(FLOW_FIXTURE.nodes.length));
  expect(canvas?.getAttribute("data-edge-count")).toBe(String(FLOW_FIXTURE.edges.length));
  expect(canvas?.getAttribute("aria-label")).toContain("directed connections");
  const draws = arc.mock.calls.length / FLOW_FIXTURE.nodes.length;
  expect(draws).toBeGreaterThanOrEqual(1);
  expect(Number.isInteger(draws)).toBe(true);
  expect(lineTo).toHaveBeenCalledTimes(FLOW_FIXTURE.edges.length * 3 * draws);
  act(() => root.unmount());
  vi.restoreAllMocks();
});
