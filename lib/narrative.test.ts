import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateWhatChangedNarrative } from "@/lib/narrative";
import { getFixtureActivityData } from "@/lib/fixtures/activity";
import type { ActivityVisualizationResponse } from "@/lib/types";

describe("generateWhatChangedNarrative", () => {
  it("generates deterministic narrative bullets given fixture payloads (golden test)", () => {
    const current = getFixtureActivityData("7d") as unknown as ActivityVisualizationResponse;
    const baseline = getFixtureActivityData("1d") as unknown as ActivityVisualizationResponse;

    const narrative = generateWhatChangedNarrative({
      current,
      baseline,
      periodLabel: "Last 7 days",
      comparePeriodLabel: "Previous 24 hours",
    });

    assert.ok(narrative);
    assert.equal(narrative.periodLabel, "Last 7 days");
    assert.equal(narrative.comparePeriodLabel, "Previous 24 hours");
    assert.ok(narrative.bullets.length >= 3 && narrative.bullets.length <= 5);

    // Verify golden output stability
    const bulletIds = narrative.bullets.map((b) => b.id);
    assert.deepEqual(bulletIds, [
      "soroban-share",
      "total-ops",
      "active-wallets",
      "top-category",
    ]);

    // Check specific narrative contents
    assert.ok(narrative.bullets[0].text.includes("Soroban share"));
    assert.ok(narrative.bullets[0].chartHref?.includes("category-share"));

    assert.ok(narrative.bullets[1].text.includes("Total operations"));
    assert.ok(narrative.bullets[1].chartHref?.includes("activity-analysis"));

    assert.ok(narrative.bullets[2].text.includes("Active wallets"));
    assert.ok(narrative.bullets[2].chartHref?.includes("kpi-active-wallets"));
  });

  it("returns null when baseline is missing", () => {
    const current = getFixtureActivityData("7d") as unknown as ActivityVisualizationResponse;
    const narrative = generateWhatChangedNarrative({
      current,
      baseline: null,
    });
    assert.equal(narrative, null);
  });

  it("returns null when current data is missing", () => {
    const baseline = getFixtureActivityData("1d") as unknown as ActivityVisualizationResponse;
    const narrative = generateWhatChangedNarrative({
      current: null,
      baseline,
    });
    assert.equal(narrative, null);
  });

  it("returns null when period is incomplete (escape hatch)", () => {
    const current = {
      ...(getFixtureActivityData("7d") as unknown as ActivityVisualizationResponse),
      isPeriodComplete: false,
    };
    const baseline = getFixtureActivityData("1d") as unknown as ActivityVisualizationResponse;

    const narrative = generateWhatChangedNarrative({
      current,
      baseline,
    });
    assert.equal(narrative, null);
  });

  it("never invents metrics not present in payload", () => {
    const current = {
      ...(getFixtureActivityData("7d") as unknown as ActivityVisualizationResponse),
      kpis: {
        totalOps: { kind: "operations" as const, unit: "ops" as const, value: 100 },
        sorobanShare: { kind: "share" as const, unit: "percent" as const, value: 10 },
      } as any,
    };
    const baseline = {
      ...(getFixtureActivityData("1d") as unknown as ActivityVisualizationResponse),
      kpis: {
        totalOps: { kind: "operations" as const, unit: "ops" as const, value: 50 },
        sorobanShare: { kind: "share" as const, unit: "percent" as const, value: 8 },
      } as any,
    };

    // When fewer than 3 bullets can be generated from real metrics, returns null
    const narrative = generateWhatChangedNarrative({
      current,
      baseline,
    });
    assert.equal(narrative, null);
  });

  it("includes payments volume bullet when usdc volume data is present", () => {
    const current = {
      ...(getFixtureActivityData("7d") as unknown as ActivityVisualizationResponse),
      usdcPaymentVolume: {
        amount: 250_000,
        unit: "USDC" as const,
        assetSetId: "test",
        methodology: "test",
        assets: [],
      },
    };
    const baseline = {
      ...(getFixtureActivityData("1d") as unknown as ActivityVisualizationResponse),
      usdcPaymentVolume: {
        amount: 100_000,
        unit: "USDC" as const,
        assetSetId: "test",
        methodology: "test",
        assets: [],
      },
    };

    const narrative = generateWhatChangedNarrative({
      current,
      baseline,
    });
    assert.ok(narrative);
    const paymentsBullet = narrative.bullets.find((b) => b.id === "payments-volume");
    assert.ok(paymentsBullet);
    assert.ok(paymentsBullet.text.includes("Payments volume led by USDC"));
    assert.ok(paymentsBullet.text.includes("+150%"));
    assert.ok(paymentsBullet.chartHref?.includes("metric=usdc"));
  });
});
