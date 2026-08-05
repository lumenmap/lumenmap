import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isValidPeriod } from "./periods";

describe("isValidPeriod", () => {
  test("accepts supported periods and rejects unsupported values", () => {
    assert.equal(isValidPeriod("1d"), true);
    assert.equal(isValidPeriod("7d"), true);
    assert.equal(isValidPeriod("30d"), true);
    assert.equal(isValidPeriod("month"), true);
    assert.equal(isValidPeriod("1y"), false);
    assert.equal(isValidPeriod(null), false);
  });
});
