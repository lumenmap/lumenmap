import { act } from "react";
import { createRoot } from "react-dom/client";
import { getAllByTestId, getByTestId } from "@testing-library/dom";
import { SorobanFeePanelView } from "./SorobanFeePanelView";
import { buildSorobanFeeFixture } from "@/lib/soroban-fees/fixture";

describe("SorobanFeePanelView", () => {
  it("renders the documented fixture sample", () => {
    const fixture = buildSorobanFeeFixture({
      period: "7d",
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-08T00:00:00.000Z",
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<SorobanFeePanelView result={fixture} />);
      });

      expect(getByTestId(container, "soroban-fee-total").textContent).toContain(
        "1,250,000,000",
      );
      expect(getByTestId(container, "soroban-fee-avg").textContent).toContain(
        "18,000",
      );
      expect(getByTestId(container, "soroban-fee-invokes").textContent).toContain(
        "50,000",
      );
      expect(getAllByTestId(container, "soroban-fee-contract")).toHaveLength(3);
      expect(getByTestId(container, "soroban-fee-note").textContent).toContain(
        "1,250,000,000 stroops",
      );
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("renders an unavailable result without throwing", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <SorobanFeePanelView
            result={{
              status: "unavailable",
              source: "hubble",
              period: "1d",
              start: "2026-01-01T00:00:00.000Z",
              end: "2026-01-02T00:00:00.000Z",
              reason: "schema_drift",
              message:
                "Soroban fee columns are not available in the current Hubble schema.",
            }}
          />,
        );
      });

      expect(
        getByTestId(container, "soroban-fee-unavailable").textContent,
      ).toContain("not available");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
