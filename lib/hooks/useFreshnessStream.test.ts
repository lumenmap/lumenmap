import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isKeyMatchingActivity } from "./useFreshnessStream";

describe("isKeyMatchingActivity", () => {
  test("returns false for non-activity keys", () => {
    assert.equal(isKeyMatchingActivity("category-share:v1:1d"), false);
    assert.equal(isKeyMatchingActivity("label:GA123"), false);
  });

  test("matches when period and network match exactly", () => {
    const key = "activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z";
    assert.equal(isKeyMatchingActivity(key, "1d", "mainnet"), true);
  });

  test("does not match when period differs", () => {
    const key = "activity:v14:mainnet:7d:2026-10-22T00:00:00.000Z";
    assert.equal(isKeyMatchingActivity(key, "1d", "mainnet"), false);
  });

  test("does not match when network differs", () => {
    const key = "activity:v14:testnet:1d:2026-10-22T00:00:00.000Z";
    assert.equal(isKeyMatchingActivity(key, "1d", "mainnet"), false);
  });

  test("matches when period or network filter is undefined", () => {
    const key = "activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z";
    assert.equal(isKeyMatchingActivity(key, undefined, "mainnet"), true);
    assert.equal(isKeyMatchingActivity(key, "1d", undefined), true);
    assert.equal(isKeyMatchingActivity(key, undefined, undefined), true);
  });
});
