import assert from "node:assert/strict";
import { describe, it } from "node:test";
import storybookMain from "../../.storybook/main";
import storybookPreview from "../../.storybook/preview";
import {
  DASHBOARD_STORY_CATALOG,
  validateStoryCatalog,
} from "./catalog";

describe("Storybook dashboard catalog (#465)", () => {
  it("defines >= 6 fixture-only stories across KpiCards, TreemapMetricSelector, PeriodSelector, DetailPanel, and FlowView", () => {
    const result = validateStoryCatalog();
    assert.equal(result.valid, true);
    assert.ok(result.storyCount >= 6);
    assert.deepEqual(
      result.coveredComponents.sort(),
      [
        "DetailPanel",
        "FlowView",
        "KpiCards",
        "PeriodSelector",
        "TreemapMetricSelector",
      ],
    );
    assert.deepEqual(
      result.coveredStates.sort(),
      ["empty", "error", "loaded", "loading"],
    );
  });

  it("includes FlowView loading, empty, and error stories with fixtureOnly=true", () => {
    const flowStories = DASHBOARD_STORY_CATALOG.filter(
      (story) => story.component === "FlowView",
    );
    assert.equal(flowStories.length, 4);
    assert.ok(flowStories.some((s) => s.state === "loading"));
    assert.ok(flowStories.some((s) => s.state === "empty"));
    assert.ok(flowStories.some((s) => s.state === "error"));
    assert.ok(flowStories.every((s) => s.fixtureOnly === true));
  });

  it("exposes Storybook main and preview config aligned with fixture mode", () => {
    assert.equal(storybookMain.framework.name, "@storybook/nextjs");
    assert.ok(storybookMain.stories.length > 0);
    assert.equal(storybookPreview.parameters.fixtureOnly, true);
  });
});
