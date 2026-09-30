import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { classifyError } from "@/lib/log";
import { BigQueryLimitExceededError } from "@/lib/hubble/errors";
import {
  readSoftFailureCount,
  runOptionalQuery,
} from "@/lib/hubble/soft-fail";
import { metrics } from "@/lib/telemetry/metrics";

let originalLog: typeof console.log;
let originalError: typeof console.error;

beforeEach(() => {
  metrics.reset();
  originalLog = console.log;
  originalError = console.error;
  console.log = () => {};
  console.error = () => {};
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
});

describe("classifyError schema drift", () => {
  it("classifies unrecognized columns as schema errors", () => {
    assert.equal(
      classifyError(
        new Error("Unrecognized name: asset_code at [2:3]; Did you mean asset_code?"),
      ),
      "schema",
    );
  });

  it("classifies missing tables as schema errors", () => {
    assert.equal(
      classifyError(new Error("Not found: Table `proj.dataset.table` was not found")),
      "schema",
    );
  });
});

describe("runOptionalQuery", () => {
  it("returns the executor result when the optional query succeeds", async () => {
    const result = await runOptionalQuery<Record<string, unknown>[]>(
      "usdcCategory",
      async () => [{ op_count: 3 }],
      () => [],
      "corr-1",
    );

    assert.deepEqual(result, [{ op_count: 3 }]);
    assert.equal(readSoftFailureCount("usdcCategory", "provider"), 0);
  });

  it("soft-fails a timeout and increments the timeout counter", async () => {
    const result = await runOptionalQuery<Record<string, unknown>[]>(
      "usdcCategory",
      async () => {
        throw new Error("Request deadline exceeded");
      },
      () => [],
      "corr-2",
    );

    assert.deepEqual(result, []);
    assert.equal(readSoftFailureCount("usdcCategory", "timeout"), 1);
  });

  it("soft-fails schema drift and increments the schema counter", async () => {
    const result = await runOptionalQuery<Record<string, unknown>[]>(
      "usdcAccount",
      async () => {
        throw new Error("Unrecognized name: account_id at [3:1]");
      },
      () => [],
      "corr-3",
    );

    assert.deepEqual(result, []);
    assert.equal(readSoftFailureCount("usdcAccount", "schema"), 1);
  });

  it("soft-fails bytes-billed limit errors as cost_limit", async () => {
    const result = await runOptionalQuery<Record<string, unknown>[]>(
      "usdcPaymentVolume",
      async () => {
        throw new BigQueryLimitExceededError(
          "Query scan budget exceeded. Please narrow the time range or filters to reduce data usage.",
          1024,
          "SELECT 1",
          {},
        );
      },
      () => [],
      "corr-4",
    );

    assert.deepEqual(result, []);
    assert.equal(readSoftFailureCount("usdcPaymentVolume", "cost_limit"), 1);
  });

  it("counts failures independently per query name", async () => {
    await runOptionalQuery(
      "transactionCategory",
      async () => {
        throw new Error("operation timed out");
      },
      () => [],
      "corr-5",
    );
    await runOptionalQuery(
      "accountMetadata",
      async () => {
        throw new Error("operation timed out");
      },
      () => [],
      "corr-5",
    );

    assert.equal(readSoftFailureCount("transactionCategory", "timeout"), 1);
    assert.equal(readSoftFailureCount("accountMetadata", "timeout"), 1);
    assert.equal(readSoftFailureCount("usdcCategory", "timeout"), 0);
  });

  it("creates a fresh fallback for every soft failure", async () => {
    const first = await runOptionalQuery<number[]>(
      "repeat",
      async () => {
        throw new Error("boom");
      },
      () => [],
      "corr-6",
    );
    const second = await runOptionalQuery<number[]>(
      "repeat",
      async () => {
        throw new Error("boom");
      },
      () => [],
      "corr-6",
    );

    assert.deepEqual(first, []);
    assert.deepEqual(second, []);
    assert.notEqual(first, second);
    assert.equal(readSoftFailureCount("repeat", "provider"), 2);
  });

  it("never throws so callers can keep serving partial results", async () => {
    await assert.doesNotReject(() =>
      runOptionalQuery<Record<string, unknown>[]>(
        "safe",
        async () => {
          throw new Error("kaboom");
        },
        () => [],
        "corr-7",
      ),
    );
  });
});
