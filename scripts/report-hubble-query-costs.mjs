#!/usr/bin/env node

import pkg from "@next/env";
import { BigQuery } from "@google-cloud/bigquery";
import { ACCOUNT_QUERY_TYPES, queryRegistry } from "../lib/hubble/shared-queries.mjs";

const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const HOT_QUERY_NAMES = [
  "assetPaymentVolumeQuery",
  "categoryQuery",
  "contractQuery",
  "accountQuery",
  "paymentFlowEdgesQuery",
  "sorobanFunctionContractQuery",
];

const keyBase64 = process.env.GCP_SERVICE_ACCOUNT_KEY;
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!keyBase64 && !credentialPath) {
  console.log(
    "Skipping Hubble cost report: no BigQuery credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or GCP_SERVICE_ACCOUNT_KEY to run dry runs.",
  );
  process.exit(0);
}

function createClient() {
  if (!keyBase64) {
    return new BigQuery({ projectId: process.env.GCP_PROJECT_ID ?? "stellar-501912" });
  }

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(keyBase64, "base64").toString("utf8"));
  } catch {
    console.error("Unable to decode GCP_SERVICE_ACCOUNT_KEY as service-account JSON.");
    process.exit(1);
  }

  return new BigQuery({ projectId: credentials.project_id, credentials });
}

const end = new Date().toISOString();
const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function paramsFor(entry) {
  const params = {};
  if (entry.requiredParams.includes("start")) params.start = start;
  if (entry.requiredParams.includes("end")) params.end = end;
  if (entry.requiredParams.includes("types")) params.types = ACCOUNT_QUERY_TYPES;
  if (entry.requiredParams.includes("ids")) params.ids = [];
  if (entry.requiredParams.includes("assets")) params.assets = [];
  return params;
}

const registryByName = new Map(queryRegistry.map((entry) => [entry.name, entry]));
const missing = HOT_QUERY_NAMES.filter((name) => !registryByName.has(name));
if (missing.length > 0) {
  console.error(`Cost report registry mismatch: ${missing.join(", ")}`);
  process.exit(1);
}

const client = createClient();
let failed = false;

console.log("Hubble query dry-run estimates (24-hour window)");

for (const name of HOT_QUERY_NAMES) {
  const entry = registryByName.get(name);
  try {
    const [job] = await client.createQueryJob({
      query: entry.sql,
      params: paramsFor(entry),
      dryRun: true,
      useLegacySql: false,
    });
    const rawBytes = job.metadata?.statistics?.totalBytesProcessed ?? "0";
    const bytes = Number(rawBytes);
    const mebibytes = Number.isFinite(bytes) ? bytes / (1024 * 1024) : 0;
    console.log(`${name}: ${rawBytes} bytes (${mebibytes.toFixed(2)} MiB)`);
  } catch (error) {
    failed = true;
    console.error(`${name}: dry run failed (${error instanceof Error ? error.message : "unknown error"})`);
  }
}

if (failed) process.exit(1);

