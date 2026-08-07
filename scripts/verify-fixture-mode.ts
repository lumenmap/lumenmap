import assert from "node:assert/strict";
import { resolveDataSource } from "@/lib/data-source";
import { getFixtureActivityData } from "@/lib/fixtures/activity";
import { toVisualizationResponse } from "@/app/api/activity/_handler";
import { validateActivityResponse } from "@/lib/schemas/validate-activity-response";

function main() {
  assert.equal(
    resolveDataSource({
      LUMENMAP_DATA_SOURCE: "fixture",
      NODE_ENV: "development",
    }),
    "fixture",
  );
  assert.throws(() =>
    resolveDataSource({
      LUMENMAP_DATA_SOURCE: "fixture",
      NODE_ENV: "production",
    }),
  );

  const data = getFixtureActivityData("1d");
  assert.equal(data.source, "fixture");
  const validated = validateActivityResponse({
    ...toVisualizationResponse(data),
    source: "fixture",
    fixture: true,
  });
  assert.equal(validated.fixture, true);
  assert.ok(validated.treemaps.events);
  console.log("verify-fixture-mode: OK");
}

main();
