import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HorizonFallbackBanner } from "./HorizonFallbackBanner";

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

test("the banner is always visible while fallback is active", () => {
  act(() => {
    root.render(
      <HorizonFallbackBanner
        report={{ active: true, source: "horizon", operationCount: 7 }}
      />,
    );
  });
  expect(container.textContent).toContain("Degraded · Horizon fallback");
  expect(container.textContent).toContain("7");
  expect(container.textContent).toContain("Horizon only");
});

test("a healthy Hubble path renders no banner", () => {
  act(() => {
    root.render(
      <HorizonFallbackBanner
        report={{ active: false, source: "none", operationCount: null }}
      />,
    );
  });
  expect(container.querySelector("[data-testid='horizon-fallback-banner']")).toBeNull();
});
