import { describe, expect, it } from "vitest";
import { buildChartDeepLink, chartIdFromHash } from "@/lib/chart-deep-link";

describe("chart deep links", () => {
  it("preserves existing dashboard parameters and replaces the hash", () => {
    expect(buildChartDeepLink(
      "https://lumenmap.example/overview?period=30d&metric=ops#old",
      "category-share-chart",
    )).toBe("https://lumenmap.example/overview?period=30d&metric=ops#category-share-chart");
  });

  it("only restores safe, unique DOM-style IDs", () => {
    expect(chartIdFromHash("#network-treemap")).toBe("network-treemap");
    expect(chartIdFromHash("#network%20treemap")).toBeNull();
    expect(() => buildChartDeepLink("https://example.com", "Not valid")).toThrow();
  });
});

