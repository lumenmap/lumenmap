import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateEntities } from "./validate-entities.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const address = "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH";
const valid = { name: "SoroSwap Router", category: "defi", protocol: "SoroSwap" };

test("the current curated registry passes", () => {
  assert.deepEqual(validateEntities(readFileSync(new URL("../data/entities.json", import.meta.url), "utf8")), []);
});

test("valid entries pass", () => {
  assert.deepEqual(validateEntities(JSON.stringify({ [address]: valid })), []);
});

test("invalid fixture fails the command with actionable errors", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-entities.mjs", "scripts/fixtures/entities-invalid.json"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate address: GINVALID/);
  assert.match(result.stderr, /address must be a 56-character/);
  assert.match(result.stderr, /protocol must be a non-empty string/);
  assert.match(result.stderr, /category must be one of/);
});

test("duplicate top-level addresses fail even when JSON.parse would overwrite one", () => {
  const source = `{ "${address}": ${JSON.stringify(valid)}, "${address}": ${JSON.stringify(valid)} }`;
  assert.match(validateEntities(source).join("\n"), /Duplicate address/);
});

test("malformed data and missing fields fail", () => {
  assert.match(validateEntities("[").join("\n"), /Invalid JSON/);
  assert.match(validateEntities("[]").join("\n"), /Registry must be an object/);
  assert.match(validateEntities(JSON.stringify({ [address]: null })).join("\n"), /entity must be an object/);
  assert.match(validateEntities(JSON.stringify({ [address]: { name: " ", category: "defi", protocol: 42 } })).join("\n"), /name must be a non-empty string/);
});

test("protocol tags taxonomy validation enforces canonical tags and uniqueness", () => {
  assert.deepEqual(
    validateEntities(JSON.stringify({ [address]: { ...valid, tags: ["dex", "payments"] } })),
    [],
  );
  assert.match(
    validateEntities(JSON.stringify({ [address]: { ...valid, tags: [] } })).join("\n"),
    /tags must be a non-empty array/,
  );
  assert.match(
    validateEntities(JSON.stringify({ [address]: { ...valid, tags: ["unknown-tag"] } })).join("\n"),
    /tag "unknown-tag" must be one of/,
  );
  assert.match(
    validateEntities(JSON.stringify({ [address]: { ...valid, tags: ["dex", "dex"] } })).join("\n"),
    /duplicate tag "dex"/,
  );
});
