import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ClaimableVelocityView } from "./ClaimableVelocityChart";
import { buildClaimableVelocity } from "@/lib/metrics/claimable-velocity";
import {
  CLAIMABLE_VELOCITY_EMPTY_FIXTURE,
  CLAIMABLE_VELOCITY_FIXTURE,
  CLAIMABLE_VELOCITY_RANGE,
} from "@/lib/metrics/claimable-velocity-fixture";

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

test("the fixture chart states creates, claims, and the net delta in text", () => {
  const result = buildClaimableVelocity(
    CLAIMABLE_VELOCITY_FIXTURE,
    CLAIMABLE_VELOCITY_RANGE,
  );
  act(() => {
    root.render(<ClaimableVelocityView result={result} />);
  });
  expect(container.textContent).toContain("2026-11-20");
  expect(container.textContent).toContain("6 created, 3 claimed");
  expect(container.textContent).toContain("Net outstanding delta: +1");
  expect(container.textContent).not.toContain("2026-11-01");
  expect(container.textContent).toContain("Classification");
  expect(container.textContent).toContain("Limits");
});

test("shows an empty state when create and claim activity is zero", () => {
  const result = buildClaimableVelocity(
    CLAIMABLE_VELOCITY_EMPTY_FIXTURE,
    CLAIMABLE_VELOCITY_RANGE,
  );
  act(() => {
    root.render(<ClaimableVelocityView result={result} />);
  });
  expect(container.textContent).toContain(
    "No claimable-balance create or claim activity in this period.",
  );
});
