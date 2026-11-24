#!/usr/bin/env node
/**
 * Compare docs/hubble-column-contract (via data/hubble-schema-contract.json)
 * against a fixture snapshot or live INFORMATION_SCHEMA.
 *
 * Dry-run (default): SCHEMA_DRIFT_MODE=fixture
 * Live: SCHEMA_DRIFT_MODE=live with GCP credentials
 * Skip: SCHEMA_DRIFT_SKIP=1
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = join(root, "data/hubble-schema-contract.json");
const fixturePath = join(root, "data/hubble-schema-fixture.json");

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function summarize(missing) {
  if (missing.length === 0) {
    return { ok: true, lines: ["PASS: all required Hubble columns are present."] };
  }
  const lines = ["FAIL: missing required Hubble columns:"];
  for (const row of missing) {
    const owners = row.owners.length ? row.owners.join(", ") : "(unmapped)";
    lines.push(
      `  - ${row.table}.${row.column} → owning queries: ${owners}`,
    );
  }
  return { ok: false, lines };
}

export function diffAgainstSnapshot(contract, snapshotTables) {
  const missing = [];
  for (const [table, spec] of Object.entries(contract.tables)) {
    const present = new Set(snapshotTables[table] ?? []);
    for (const column of spec.requiredColumns) {
      if (!present.has(column)) {
        missing.push({
          table,
          column,
          owners: spec.owners?.[column] ?? [],
        });
      }
    }
  }
  return missing;
}

async function loadLiveColumns(dataset) {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const client = new BigQuery();
  const [projectId, datasetId] = dataset.split(".");
  if (!projectId || !datasetId) {
    throw new Error(`Invalid dataset id: ${dataset}`);
  }
  const tables = {};
  const [rows] = await client.query({
    query: `
      SELECT table_name, column_name
      FROM \`${projectId}.${datasetId}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name IN UNNEST(@tables)
    `,
    params: {
      tables: Object.keys(loadJson(contractPath).tables),
    },
    useLegacySql: false,
  });
  for (const row of rows) {
    const table = String(row.table_name);
    const column = String(row.column_name);
    if (!tables[table]) tables[table] = [];
    tables[table].push(column);
  }
  return tables;
}

function hasGcpCredentials() {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GCP_SERVICE_ACCOUNT_KEY,
  );
}

async function main() {
  if (process.env.SCHEMA_DRIFT_SKIP === "1" || process.env.SCHEMA_DRIFT_SKIP === "true") {
    console.log("SKIP: SCHEMA_DRIFT_SKIP is set.");
    process.exit(0);
  }

  const contract = loadJson(contractPath);
  const mode = (process.env.SCHEMA_DRIFT_MODE || "fixture").toLowerCase();

  let snapshotTables;
  if (mode === "fixture" || mode === "dry-run" || mode === "dryrun") {
    snapshotTables = loadJson(fixturePath).tables;
    console.log("MODE: fixture (dry-run against recorded schema snapshot)");
  } else if (mode === "live") {
    if (!hasGcpCredentials()) {
      console.log(
        "SKIP: live schema-drift check requested but GCP credentials are absent.",
      );
      process.exit(0);
    }
    console.log("MODE: live INFORMATION_SCHEMA");
    snapshotTables = await loadLiveColumns(
      process.env.LUMENMAP_BIGQUERY_DATASET || contract.dataset,
    );
  } else {
    console.error(`Unknown SCHEMA_DRIFT_MODE=${mode}`);
    process.exit(2);
  }

  const missing = diffAgainstSnapshot(contract, snapshotTables);
  const { ok, lines } = summarize(missing);
  for (const line of lines) console.log(line);
  process.exit(ok ? 0 : 1);
}

const isDirect =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
