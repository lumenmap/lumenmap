import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseCustomPeriod,
  encodeCustomPeriod,
  isValidPeriod,
  resolvePeriod,
  MAX_CUSTOM_RANGE_DAYS,
} from "./periods";

describe("parseCustomPeriod", () => {
  it("parses valid custom period", () => {
    const result = parseCustomPeriod("custom:2024-01-01:2024-01-07");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.range.start, new Date("2024-01-01T00:00:00.000Z"));
      assert.deepEqual(result.range.end, new Date("2024-01-07T23:59:59.999Z"));
    }
  });

  it("rejects invalid format", () => {
    const result = parseCustomPeriod("custom:2024-01-01");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "INVALID_FORMAT");
    }
  });

  it("rejects invalid dates", () => {
    const result = parseCustomPeriod("custom:2024-13-01:2024-01-31");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "INVALID_DATE");
    }
  });

  it("rejects inverted range", () => {
    const result = parseCustomPeriod("custom:2024-01-31:2024-01-01");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "INVERTED_RANGE");
      assert.ok(result.error.includes("before or equal"));
    }
  });

  it("rejects range exceeding max days", () => {
    const result = parseCustomPeriod("custom:2024-01-01:2024-05-01");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "RANGE_TOO_LONG");
      assert.ok(result.error.includes(String(MAX_CUSTOM_RANGE_DAYS)));
    }
  });

  it("accepts range at max boundary", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date(start.getTime() + MAX_CUSTOM_RANGE_DAYS * 86_400_000 - 1);
    const endStr = end.toISOString().split("T")[0];
    const result = parseCustomPeriod(`custom:2024-01-01:${endStr}`);
    assert.equal(result.ok, true);
  });

  it("accepts single day range", () => {
    const result = parseCustomPeriod("custom:2024-01-15:2024-01-15");
    assert.equal(result.ok, true);
  });
});

describe("encodeCustomPeriod", () => {
  it("encodes date range to custom period string", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-07T23:59:59.999Z");
    const encoded = encodeCustomPeriod(start, end);
    assert.equal(encoded, "custom:2024-01-01:2024-01-07");
  });

  it("handles dates with time components", () => {
    const start = new Date("2024-06-15T14:30:00.000Z");
    const end = new Date("2024-06-20T08:15:00.000Z");
    const encoded = encodeCustomPeriod(start, end);
    assert.equal(encoded, "custom:2024-06-15:2024-06-20");
  });
});

describe("isValidPeriod", () => {
  it("accepts preset periods", () => {
    assert.equal(isValidPeriod("1d"), true);
    assert.equal(isValidPeriod("7d"), true);
    assert.equal(isValidPeriod("30d"), true);
    assert.equal(isValidPeriod("month"), true);
  });

  it("accepts valid custom periods", () => {
    assert.equal(isValidPeriod("custom:2024-01-01:2024-01-07"), true);
  });

  it("rejects invalid custom periods", () => {
    assert.equal(isValidPeriod("custom:2024-01-31:2024-01-01"), false); // inverted
    assert.equal(isValidPeriod("custom:2024-01-01:2024-12-31"), false); // too long
    assert.equal(isValidPeriod("custom:invalid:format"), false);
  });

  it("rejects unknown periods", () => {
    assert.equal(isValidPeriod("90d"), false);
    assert.equal(isValidPeriod(null), false);
    assert.equal(isValidPeriod(""), false);
  });
});

describe("resolvePeriod with custom ranges", () => {
  it("resolves valid custom period", () => {
    const result = resolvePeriod("custom:2024-03-01:2024-03-15");
    assert.equal(result.period, "custom:2024-03-01:2024-03-15");
    assert.deepEqual(result.start, new Date("2024-03-01T00:00:00.000Z"));
    assert.deepEqual(result.end, new Date("2024-03-15T23:59:59.999Z"));
    assert.ok(result.label.includes("Mar"));
  });

  it("falls back to 1d for invalid custom period", () => {
    const now = new Date("2024-06-15T12:00:00.000Z");
    const result = resolvePeriod("custom:invalid:format", now);
    assert.equal(result.period, "1d");
    assert.equal(result.label, "Today");
  });

  it("generates appropriate labels for custom ranges", () => {
    // Same month
    const result1 = resolvePeriod("custom:2024-01-05:2024-01-20");
    assert.match(result1.label, /Jan.*20, 2024/);

    // Different months, same year
    const result2 = resolvePeriod("custom:2024-01-25:2024-02-10");
    assert.match(result2.label, /Jan.*Feb.*2024/);

    // Different years
    const result3 = resolvePeriod("custom:2023-12-20:2024-01-10");
    assert.match(result3.label, /2023.*2024/);
  });
});
