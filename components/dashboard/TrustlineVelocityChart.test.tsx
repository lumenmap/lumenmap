import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TrustlineVelocityView } from "./TrustlineVelocityChart";
import { buildTrustlineVelocity } from "@/lib/metrics/trustline-velocity";
import {
  TRUSTLINE_VELOCITY_FIXTURE,
  TRUSTLINE_VELOCITY_RANGE,
} from "@/lib/metrics/trustline-velocity-fixture";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test("the fixture chart states creates, removes, and the net change in text", () => {
  const result = buildTrustlineVelocity(TRUSTLINE_VELOCITY_FIXTURE, TRUSTLINE_VELOCITY_RANGE);
  act(() => {
    root.render(<TrustlineVelocityView result={result} />);
  });
  expect(container.textContent).toContain("2026-11-20");
  expect(container.textContent).toContain("5 created, 2 removed");
  expect(container.textContent).toContain("Net trustline change: +7");
  expect(container.textContent).not.toContain("2026-11-01");
});
