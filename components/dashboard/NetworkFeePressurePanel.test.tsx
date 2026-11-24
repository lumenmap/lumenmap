import { act } from "react";
import { createRoot } from "react-dom/client";
import { getByTestId, queryByTestId } from "@testing-library/dom";
import { NetworkFeePressurePanelView } from "./NetworkFeePressurePanel";
import type { FeePressure } from "@/lib/network-fee-pressure";

const result: FeePressure = {
  period: "1d", granularity: "hour", source: "fixture",
  classic: [{ timestamp: "2026-01-01T00:00:00.000Z", stroops: 100 }],
  soroban: [{ timestamp: "2026-01-01T00:00:00.000Z", stroops: 18_000 }],
};
const buckets = [{ timestamp: "2026-01-01T00:00:00.000Z", label: "00:00 UTC", operations: 1_000, transactions: 900 }];

describe("NetworkFeePressurePanelView", () => {
  it("renders fixture values, units, and operation correlation", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      act(() => root.render(<NetworkFeePressurePanelView result={result} buckets={buckets} />));
      const panel = getByTestId(container, "network-fee-pressure");
      expect(panel.textContent).toContain("100 stroops/op");
      expect(panel.textContent).toContain("18,000 stroops/transaction");
      expect(panel.textContent).toContain("Operations on the same period");
      expect(panel.textContent).toContain("Fixture sample");
      expect(panel.querySelectorAll("svg[role='img']")).toHaveLength(3);
    } finally { act(() => root.unmount()); }
  });

  it("hides when both series are unavailable", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      act(() => root.render(<NetworkFeePressurePanelView result={{ ...result, classic: null, soroban: null }} buckets={buckets} />));
      expect(queryByTestId(container, "network-fee-pressure")).toBeNull();
    } finally { act(() => root.unmount()); }
  });

  it("shows an available fee series when the other is unavailable", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      act(() => root.render(<NetworkFeePressurePanelView result={{ ...result, classic: null }} buckets={buckets} />));
      const panel = getByTestId(container, "network-fee-pressure");
      expect(panel.textContent).toContain("18,000 stroops/transaction");
      expect(panel.textContent).toContain("An unavailable fee series is omitted.");
      expect(panel.querySelectorAll("svg[role='img']")).toHaveLength(2);
    } finally { act(() => root.unmount()); }
  });
});
