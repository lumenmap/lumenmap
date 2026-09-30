import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, getByRole } from "@testing-library/dom";
import { FlowView } from "./FlowView";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("shows the fixture canvas and switches to the connected edge table", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<FlowView fixture />));
  expect(host.querySelector("[data-testid='flow-canvas']")?.getAttribute("data-node-count")).toBe("5");
  act(() => fireEvent.click(getByRole(host, "button", { name: "Table" })));
  expect(host.querySelector("[data-testid='flow-canvas']")).toBeNull();
  expect(host.querySelectorAll("tbody tr").length).toBe(10);
  act(() => root.unmount());
});

it("explains when the flow fixture is unavailable", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<FlowView fixture={false} />));
  expect(getByRole(host, "status").textContent).toContain("fixture mode only");
  expect(host.querySelector("canvas")).toBeNull();
  act(() => root.unmount());
});
