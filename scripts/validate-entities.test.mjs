import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PROTOCOL_TAGS, validateEntities } from "./validate-entities.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const address = "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH";
const valid = {
  name: "SoroSwap Router",
  category: "defi",
  protocol: "SoroSwap",
  tags: ["dex"],
};

test("the current curated registry passes and covers >= 3 protocol taxonomy tags", () => {
  const raw = readFileSync(new URL("../data/entities.json", import.meta.url), "utf8");
  assert.deepEqual(validateEntities(raw), []);

  const parsed = JSON.parse(raw);
  const distinctTags = new Set();
  for (const entity of Object.values(parsed)) {
    for (const tag of entity.tags ?? []) {
      distinctTags.add(tag);
    }
  }
  assert.ok(
    distinctTags.size >= 3,
    `Expected curated entities to cover >= 3 tags, found ${distinctTags.size}`,
  );
});

test("valid entries pass with or without optional closed-taxonomy tags", () => {
  assert.deepEqual(validateEntities(JSON.stringify({ [address]: valid })), []);
  assert.deepEqual(
    validateEntities(
      JSON.stringify({
        [address]: { name: "SoroSwap Router", category: "defi", protocol: "SoroSwap" },
      }),
    ),
    [],
  );
  assert.deepEqual(PROTOCOL_TAGS, [
    "dex",
    "anchor",
    "payments",
    "infra",
    "nft",
    "other",
  ]);
});

test("invalid protocol tags fail validation with actionable errors", () => {
  const unknownTagErrors = validateEntities(
    JSON.stringify({
      [address]: { ...valid, tags: ["dex", "yield-farming"] },
    }),
  );
  assert.match(unknownTagErrors.join("\n"), /tag "yield-farming" must be one of/);

  const duplicateTagErrors = validateEntities(
    JSON.stringify({
      [address]: { ...valid, tags: ["dex", "dex"] },
    }),
  );
  assert.match(duplicateTagErrors.join("\n"), /duplicate tag "dex"/);

  const emptyTagsErrors = validateEntities(
    JSON.stringify({
      [address]: { ...valid, tags: [] },
    }),
  );
  assert.match(
    emptyTagsErrors.join("\n"),
    /tags must be a non-empty array of protocol taxonomy tags/,
  );
});

test("invalid fixture fails the command with actionable errors", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/validate-entities.mjs", "scripts/fixtures/entities-invalid.json"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
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
  assert.match(
    validateEntities(JSON.stringify({ [address]: null })).join("\n"),
    /entity must be an object/,
  );
  assert.match(
    validateEntities(
      JSON.stringify({ [address]: { name: " ", category: "defi", protocol: 42 } }),
    ).join("\n"),
    /name must be a non-empty string/,
  );
});
