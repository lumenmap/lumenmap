#!/usr/bin/env node

import pkg from "@next/env";
import { BigQuery } from "@google-cloud/bigquery";
import {
  ACCOUNT_QUERY_TYPES,
  DESTINATION_QUERY_TYPES,
  TOP_CONTRACT_LIMIT,
  queryRegistry,
} from "../lib/hubble/shared-queries.mjs";

const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const keyBase64 = process.env.GCP_SERVICE_ACCOUNT_KEY;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!keyBase64 && !credPath) {
  console.error(
    "No GCP credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or GCP_SERVICE_ACCOUNT_KEY in .env.local; see .env.example for setup.",
  );
  process.exit(1);
}

const end = new Date().toISOString();
const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const baseParams = { start, end };

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

function paramsFor(entry) {
  const params = {};
  if (entry.requiredParams.includes("start")) params.start = start;
  if (entry.requiredParams.includes("end")) params.end = end;
  if (entry.requiredParams.includes("types")) {
    params.types =
      entry.name === "activeDestinationCountQuery"
        ? DESTINATION_QUERY_TYPES
        : ACCOUNT_QUERY_TYPES;
  }
  if (entry.requiredParams.includes("ids")) params.ids = [];
  if (entry.requiredParams.includes("assets")) {
    // Smoke coverage for SQL shape only; empty asset list is valid for UNNEST.
    params.assets = [];
  }
  return params;
}

// Smoke script still identifies each query by its stable registry name.
const queries = queryRegistry
  .filter((entry) =>
    [
      "categoryQuery",
      "contractQuery",
      "activeContractCountQuery",
      "accountQuery",
      "sorobanFunctionQuery",
      "sorobanFunctionContractQuery",
      "activeSourceAccountsQuery",
      "nativePaymentVolumeQuery",
      "activeDestinationCountQuery",
    ].includes(entry.name),
  )
  .map((entry) => ({
    name: entry.name,
    sql: entry.sql,
    params: { ...baseParams, ...paramsFor(entry) },
  }));

let failed = false;
const rowCounts = {};

for (const query of queries) {
  process.stdout.write(`Testing ${query.name}... `);
  try {
    const [rows] = await client.query({ query: query.sql, params: query.params });
    rowCounts[query.name] = rows.length;
    console.log(`ok (${rows.length} rows)`);
  } catch (error) {
    failed = true;
    console.log("FAILED");
    console.error(error instanceof Error ? error.message : error);
  }
}

if (
  !failed &&
  rowCounts.activeContractCountQuery !== undefined &&
  rowCounts.contractQuery !== undefined
) {
  process.stdout.write(
    "Verifying activeContractCountQuery is uncapped relative to contractQuery... ",
  );
  if (rowCounts.activeContractCountQuery < rowCounts.contractQuery) {
    failed = true;
    console.log("FAILED");
    console.error(
      `activeContractCountQuery returned ${rowCounts.activeContractCountQuery} distinct contracts, ` +
        `fewer than the ${rowCounts.contractQuery}-row capped leaderboard (limit ${TOP_CONTRACT_LIMIT}).`,
    );
  } else {
    console.log(
      `ok (${rowCounts.activeContractCountQuery} distinct contracts, independent of TOP_CONTRACT_LIMIT=${TOP_CONTRACT_LIMIT})`,
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log("All Hubble queries passed.");
