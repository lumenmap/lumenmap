import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFlowViewEnabled,
  isFlowViewRequested,
} from "./flow-feature-flag";

describe("Flow view feature flag", () => {
  it("is off by default in production, including with the query flag", () => {
    assert.equal(
      isFlowViewEnabled({
        nodeEnv: "production",
        dataSource: "live",
        envFlag: undefined,
        queryFlag: "1",
      }),
      false,
    );
  });

  it("can be enabled by maintainers in production", () => {
    assert.equal(
      isFlowViewEnabled({
        nodeEnv: "production",
        dataSource: "live",
        envFlag: "true",
        queryFlag: undefined,
      }),
      true,
    );
  });

  it("can be enabled with the query flag in development or fixture mode", () => {
    assert.equal(
      isFlowViewEnabled({
        nodeEnv: "development",
        dataSource: "live",
        envFlag: undefined,
        queryFlag: "1",
      }),
      true,
    );
    assert.equal(
      isFlowViewEnabled({
        nodeEnv: "test",
        dataSource: "fixture",
        envFlag: undefined,
        queryFlag: "true",
      }),
      true,
    );
    assert.equal(
      isFlowViewEnabled({
        nodeEnv: "production",
        dataSource: "fixture",
        envFlag: undefined,
        queryFlag: "1",
      }),
      true,
    );
  });

  it("does not enable Flow for an unrelated environment or query value", () => {
    assert.equal(
      isFlowViewEnabled({
        nodeEnv: "test",
        dataSource: "live",
        envFlag: undefined,
        queryFlag: "1",
      }),
      false,
    );
    assert.equal(isFlowViewRequested("flow"), true);
    assert.equal(isFlowViewRequested(["flow", "treemap"]), true);
    assert.equal(isFlowViewRequested(["treemap", "flow"]), false);
  });
});
