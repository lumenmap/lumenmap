import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapInvokeSuccess } from "./invoke-success";

describe("invoke success mapping", () => {
  it("reads a fixture contract without throwing on null or malformed rows", () => {
    assert.deepEqual(mapInvokeSuccess({ successfulInvokes: 80, failedInvokes: 20 }), {
      status: "ready",
      success: 80,
      failure: 20,
      rate: 0.8,
    });
    assert.equal(mapInvokeSuccess(null).status, "unavailable");
    assert.equal(mapInvokeSuccess({}).status, "unavailable");
    assert.equal(
      mapInvokeSuccess({ successfulInvokes: null, failedInvokes: 1 }).status,
      "unavailable",
    );
    assert.equal(
      mapInvokeSuccess({ successfulInvokes: -1, failedInvokes: 1 }).status,
      "unavailable",
    );
    assert.equal(
      mapInvokeSuccess({ successfulInvokes: "80", failedInvokes: 20 }).status,
      "unavailable",
    );
  });
});
