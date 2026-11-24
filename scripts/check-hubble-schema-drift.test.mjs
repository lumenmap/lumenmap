import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { diffAgainstSnapshot } from "./check-hubble-schema-drift.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("hubble schema drift dry-run", () => {
  it("passes against the recorded fixture snapshot", () => {
    const contract = JSON.parse(
      readFileSync(join(root, "data/hubble-schema-contract.json"), "utf8"),
    );
    const fixture = JSON.parse(
      readFileSync(join(root, "data/hubble-schema-fixture.json"), "utf8"),
    );
    assert.deepEqual(diffAgainstSnapshot(contract, fixture.tables), []);
  });

  it("maps a missing column to owning queries", () => {
    const contract = JSON.parse(
      readFileSync(join(root, "data/hubble-schema-contract.json"), "utf8"),
    );
    const broken = {
      ...JSON.parse(
        readFileSync(join(root, "data/hubble-schema-fixture.json"), "utf8"),
      ).tables,
    };
    broken.enriched_history_operations = broken.enriched_history_operations.filter(
      (name) => name !== "details",
    );
    const missing = diffAgainstSnapshot(contract, broken);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].column, "details");
    assert.ok(missing[0].owners.includes("activeDestinationCountQuery"));
  });
});
