#!/usr/bin/env node

import { BigQuery } from "@google-cloud/bigquery";
import {
  HUBBLE_COLUMN_CONTRACT,
  buildInformationSchemaQuery,
  compareSchemaToContract,
  verifyQueryRegistryTablesAgainstContract,
} from "../lib/hubble/schema-drift.ts";

const args = new Set(process.argv.slice(2));
const forceOffline = args.has("--offline");

const registryCheck = verifyQueryRegistryTablesAgainstContract();
if (!registryCheck.ok) {
  console.error("Schema contract error — unregistered Hubble table(s) in queryRegistry:");
  for (const item of registryCheck.unknownTables) {
    console.error(`  - ${item.queryName}: ${item.table}`);
  }
  process.exit(1);
}

const keyBase64 = process.env.GCP_SERVICE_ACCOUNT_KEY;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (forceOffline || (!keyBase64 && !credPath)) {
  const baselineColumns = Object.fromEntries(
    Object.entries(HUBBLE_COLUMN_CONTRACT).map(([table, spec]) => [
      table,
      [...spec.requiredColumns, ...spec.optionalColumns],
    ]),
  );
  const report = compareSchemaToContract(baselineColumns);
  if (!report.ok) {
    console.error("Offline schema contract self-check failed:", report);
    process.exit(1);
  }
  console.log(
    `ok — Hubble column contract validated across ${Object.keys(report.tables).length} tables (offline mode)`,
  );
  process.exit(0);
}

let client;
if (keyBase64) {
  const credentials = JSON.parse(
    Buffer.from(keyBase64, "base64").toString("utf-8"),
  );
  client = new BigQuery({
    projectId: credentials.project_id,
    credentials,
  });
} else {
  client = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID ?? "stellar-501912",
  });
}

const { sql, params } = buildInformationSchemaQuery();
const [rows] = await client.query({ query: sql, params, useLegacySql: false });

const liveColumnsByTable = {};
for (const row of rows) {
  const tableName = String(row.table_name ?? "");
  const columnName = String(row.column_name ?? "");
  if (!tableName || !columnName) continue;
  if (!liveColumnsByTable[tableName]) {
    liveColumnsByTable[tableName] = [];
  }
  liveColumnsByTable[tableName].push(columnName);
}

const report = compareSchemaToContract(liveColumnsByTable);
for (const tableReport of Object.values(report.tables)) {
  if (tableReport.missingOptional.length > 0) {
    console.warn(
      `WARN [${tableReport.table}]: missing optional columns: ${tableReport.missingOptional.join(", ")}`,
    );
  }
  if (tableReport.missingRequired.length > 0) {
    console.error(
      `FAIL [${tableReport.table}]: missing required columns: ${tableReport.missingRequired.join(", ")}`,
    );
  }
}

if (!report.ok) {
  process.exit(1);
}

console.log(
  `ok — live Hubble schema matches contract across ${Object.keys(report.tables).length} tables`,
);
