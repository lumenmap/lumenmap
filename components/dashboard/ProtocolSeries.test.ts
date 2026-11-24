import { describe, expect, it } from "vitest";
import { attachProtocolSeries } from "@/lib/protocol-health/attach-series";

describe("attachProtocolSeries", () => {
  it("matches protocol names case-insensitively and preserves row order", () => {
    const rows = [{ protocol: "Soroswap", rank: 1 }, { protocol: "Blend", rank: 2 }];

    expect(attachProtocolSeries(rows, [
      { protocol: "soroswap", values: [10, 12, 15] },
      { protocol: "BLEND", values: [5, 4] },
    ])).toEqual([
      { protocol: "Soroswap", rank: 1, timeseries: [10, 12, 15] },
      { protocol: "Blend", rank: 2, timeseries: [5, 4] },
    ]);
  });

  it("soft-fails missing series and removes non-finite samples", () => {
    const rows = [{ protocol: "Missing" }, { protocol: "Orbit" }];

    expect(attachProtocolSeries(rows, [
      { protocol: "Orbit", values: [1, Number.NaN, 3] },
    ])).toEqual([
      { protocol: "Missing", timeseries: [] },
      { protocol: "Orbit", timeseries: [1, 3] },
    ]);
  });
});
