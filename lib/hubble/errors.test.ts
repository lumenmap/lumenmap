import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BigQueryLimitExceededError,
  isBytesBilledLimitExceededError,
} from "./errors";

describe("isBytesBilledLimitExceededError", () => {
  test("detects reason code", () => {
    assert.equal(
      isBytesBilledLimitExceededError({
        errors: [{ reason: "bytesBilledLimitExceeded" }],
      }),
      true,
    );
  });

  test("detects message text", () => {
    assert.equal(
      isBytesBilledLimitExceededError({
        message: "Query exceeded limit for bytes billed: 1",
      }),
      true,
    );
  });

  test("ignores unrelated errors", () => {
    assert.equal(isBytesBilledLimitExceededError(new Error("boom")), false);
    assert.equal(isBytesBilledLimitExceededError(null), false);
  });
});

describe("BigQueryLimitExceededError", () => {
  test("exposes safe public message and diagnostics", () => {
    const err = new BigQueryLimitExceededError(
      "Query scan budget exceeded. Please narrow the time range or filters to reduce data usage.",
      1024,
      "SELECT 1",
      { start: "x" },
    );
    assert.equal(err.name, "BigQueryLimitExceededError");
    assert.equal(err.limit, 1024);
    assert.match(err.message, /scan budget/);
    assert.doesNotMatch(err.message, /SELECT 1/);
  });
});
