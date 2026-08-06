import assert from "node:assert/strict";
import { describe, test, beforeEach, afterEach } from "node:test";
import { getMaxBytesBilledLimit } from "./config";

const DEFAULT = 1_073_741_824;

describe("getMaxBytesBilledLimit", () => {
  const original = process.env.BIGQUERY_MAX_BYTES_BILLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BIGQUERY_MAX_BYTES_BILLED;
    } else {
      process.env.BIGQUERY_MAX_BYTES_BILLED = original;
    }
  });

  test("missing env uses 1GB default", () => {
    delete process.env.BIGQUERY_MAX_BYTES_BILLED;
    assert.equal(getMaxBytesBilledLimit(), DEFAULT);
  });

  test("valid integer is accepted", () => {
    process.env.BIGQUERY_MAX_BYTES_BILLED = "5000000";
    assert.equal(getMaxBytesBilledLimit(), 5_000_000);
  });

  test("invalid values fall back to default", () => {
    for (const value of ["", "not-a-number", "-10", "1.5", "0", "109951162777"]) {
      process.env.BIGQUERY_MAX_BYTES_BILLED = value;
      assert.equal(getMaxBytesBilledLimit(), DEFAULT, value);
    }
  });

  test("upper bound 100GB is accepted", () => {
    process.env.BIGQUERY_MAX_BYTES_BILLED = "109951162776";
    assert.equal(getMaxBytesBilledLimit(), 109_951_162_776);
  });
});
