import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activityResponseSchema,
  type ActivityResponse,
} from "./activity-response";
import { cloneValidFixture } from "./fixtures/valid-activity-response";
import {
  ActivityResponseValidationError,
  PUBLIC_VALIDATION_ERROR,
  publicValidationErrorBody,
  validateActivityResponse,
} from "./validate-activity-response";

function expectValidationFailure(
  payload: unknown,
  pathSubstring: string,
): ActivityResponseValidationError {
  assert.throws(
    () => validateActivityResponse(payload),
    (error: unknown) => {
      assert.ok(error instanceof ActivityResponseValidationError);
      assert.match(error.path, new RegExp(pathSubstring));
      assert.match(error.diagnostic, new RegExp(pathSubstring));
      assert.doesNotMatch(error.message, /BigQuery|service account|crypto-stellar/i);
      return true;
    },
  );

  try {
    validateActivityResponse(payload);
  } catch (error) {
    assert.ok(error instanceof ActivityResponseValidationError);
    return error;
  }

  throw new Error("expected validation to fail");
}

describe("activity response schema", () => {
  it("accepts a representative valid response", () => {
    const validated = validateActivityResponse(cloneValidFixture());
    assert.equal(validated.period, "1d");
    assert.equal(validated.source, "hubble");
    assert.equal(validated.kpis.totalOps.unit, "ops");
    assert.equal(validated.metricProvenance.operation_count.metric, "operation_count");
  });

  it("rejects NaN numeric values", () => {
    const fixture = cloneValidFixture();
    fixture.kpis.totalOps.value = Number.NaN;
    expectValidationFailure(fixture, "kpis\\.totalOps\\.value");
  });

  it("rejects infinite numeric values", () => {
    const fixture = cloneValidFixture();
    fixture.treemaps.events.value = Number.POSITIVE_INFINITY;
    expectValidationFailure(fixture, "treemaps\\.events\\.value");
  });

  it("rejects malformed timestamps", () => {
    const fixture = cloneValidFixture();
    fixture.start = "not-a-timestamp";
    expectValidationFailure(fixture, "start");
  });

  it("rejects missing required metric provenance", () => {
    const fixture = cloneValidFixture() as Omit<
      ActivityResponse,
      "metricProvenance"
    > & {
      metricProvenance?: ActivityResponse["metricProvenance"];
    };
    delete fixture.metricProvenance;
    expectValidationFailure(fixture, "metricProvenance");
  });

  it("rejects incompatible metric-unit combinations", () => {
    const fixture = cloneValidFixture();
    // operations kind must use unit "ops", not "percent"
    (fixture.kpis.totalOps as { kind: string; unit: string; value: number }).unit =
      "percent";
    expectValidationFailure(fixture, "kpis\\.totalOps");
  });

  it("rejects structurally invalid treemap nodes", () => {
    const fixture = cloneValidFixture();
    fixture.treemaps.events.children = [
      {
        name: "Broken Leaf",
        // no value and no children — invalid leaf
        meta: { type: "entity", category: "other" },
      },
    ];
    expectValidationFailure(fixture, "treemaps\\.events\\.children");
  });

  it("exposes path-specific server diagnostics without leaking payload to clients", () => {
    const fixture = cloneValidFixture();
    fixture.metricProvenance.operation_count.methodology.id = "" as never;
    const error = expectValidationFailure(
      fixture,
      "metricProvenance\\.operation_count\\.methodology\\.id",
    );

    const body = publicValidationErrorBody();
    assert.deepEqual(body, { error: PUBLIC_VALIDATION_ERROR });
    assert.equal(
      JSON.stringify(body).includes(error.path),
      false,
      "public body must not include schema path",
    );
    assert.equal(
      JSON.stringify(body).includes("methodology"),
      false,
      "public body must not include field diagnostics",
    );
    assert.ok(
      error.diagnostic.includes(
        "metricProvenance.operation_count.methodology.id",
      ),
    );
  });

  it("keeps the public type aligned with the runtime schema parse output", () => {
    const parsed = activityResponseSchema.parse(cloneValidFixture());
    const validated: ActivityResponse = parsed;
    assert.equal(validated.source, "hubble");
  });
});

describe("activity route validation boundary", () => {
  it("maps an invalid provider result to a safe error and path diagnostic", () => {
    const invalidProviderResult = cloneValidFixture();
    invalidProviderResult.end = "yesterday";

    let publicBody: { error: string } | undefined;
    let diagnostic: string | undefined;

    try {
      validateActivityResponse(invalidProviderResult);
    } catch (error) {
      if (error instanceof ActivityResponseValidationError) {
        diagnostic = error.diagnostic;
        publicBody = publicValidationErrorBody();
      } else {
        throw error;
      }
    }

    assert.ok(diagnostic);
    assert.match(diagnostic, /schema path "end"/);
    assert.deepEqual(publicBody, { error: PUBLIC_VALIDATION_ERROR });
    assert.equal(JSON.stringify(publicBody).includes("yesterday"), false);
  });
});
