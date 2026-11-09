#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HUBBLE_DATASET = "crypto-stellar.crypto_stellar_dbt";

export const HUBBLE_COLUMN_CONTRACT = {
  enriched_history_operations: [
    {
      column: "closed_at",
      required: true,
      owningQueries: [
        "categoryQuery",
        "transactionCategoryQuery",
        "accountQuery",
        "nativePaymentVolumeQuery",
        "assetPaymentVolumeQuery",
        "usdcPaymentVolumeQuery",
        "activeDestinationCountQuery",
        "latestDataTimestampQuery",
        "activeSourceAccountsQuery",
        "usdcCategoryQuery",
        "usdcAccountQuery",
        "heatmapQuery",
      ],
    },
    {
      column: "type_string",
      required: true,
      owningQueries: [
        "categoryQuery",
        "transactionCategoryQuery",
        "accountQuery",
        "nativePaymentVolumeQuery",
        "assetPaymentVolumeQuery",
        "usdcPaymentVolumeQuery",
        "activeDestinationCountQuery",
        "usdcCategoryQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "amount",
      required: true,
      owningQueries: [
        "categoryQuery",
        "accountQuery",
        "nativePaymentVolumeQuery",
        "assetPaymentVolumeQuery",
        "usdcPaymentVolumeQuery",
        "usdcCategoryQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "asset_type",
      required: true,
      owningQueries: [
        "categoryQuery",
        "accountQuery",
        "nativePaymentVolumeQuery",
        "assetPaymentVolumeQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "asset_code",
      required: true,
      owningQueries: [
        "assetPaymentVolumeQuery",
        "usdcPaymentVolumeQuery",
        "usdcCategoryQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "asset_issuer",
      required: true,
      owningQueries: [
        "assetPaymentVolumeQuery",
        "usdcPaymentVolumeQuery",
        "usdcCategoryQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "source_asset_type",
      required: true,
      owningQueries: ["nativePaymentVolumeQuery", "assetPaymentVolumeQuery"],
    },
    {
      column: "source_asset_code",
      required: true,
      owningQueries: [
        "assetPaymentVolumeQuery",
        "usdcPaymentVolumeQuery",
        "usdcCategoryQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "source_asset_issuer",
      required: true,
      owningQueries: [
        "assetPaymentVolumeQuery",
        "usdcPaymentVolumeQuery",
        "usdcCategoryQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "source_amount",
      required: true,
      owningQueries: [
        "nativePaymentVolumeQuery",
        "assetPaymentVolumeQuery",
        "usdcPaymentVolumeQuery",
        "usdcCategoryQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "dest_asset_code",
      required: true,
      owningQueries: ["usdcCategoryQuery", "usdcAccountQuery"],
    },
    {
      column: "dest_asset_issuer",
      required: true,
      owningQueries: ["usdcCategoryQuery", "usdcAccountQuery"],
    },
    {
      column: "dest_amount",
      required: true,
      owningQueries: ["usdcCategoryQuery", "usdcAccountQuery"],
    },
    {
      column: "op_source_account",
      required: true,
      owningQueries: [
        "accountQuery",
        "activeSourceAccountsQuery",
        "usdcAccountQuery",
      ],
    },
    {
      column: "transaction_hash",
      required: true,
      owningQueries: ["transactionCategoryQuery"],
    },
    {
      column: "transaction_id",
      required: true,
      owningQueries: ["heatmapQuery"],
    },
    {
      column: "details.to",
      required: true,
      owningQueries: ["activeDestinationCountQuery"],
    },
    {
      column: "details.new_account",
      required: true,
      owningQueries: ["activeDestinationCountQuery"],
    },
    {
      column: "details.into",
      required: true,
      owningQueries: ["activeDestinationCountQuery"],
    },
  ],
  enriched_history_operations_soroban: [
    {
      column: "closed_at",
      required: true,
      owningQueries: ["sorobanFunctionQuery", "sorobanFunctionContractQuery"],
    },
    {
      column: "soroban_operation_type",
      required: true,
      owningQueries: ["sorobanFunctionQuery", "sorobanFunctionContractQuery"],
    },
    {
      column: "parameters_decoded",
      required: true,
      owningQueries: ["sorobanFunctionQuery", "sorobanFunctionContractQuery"],
    },
    {
      column: "contract_id",
      required: true,
      owningQueries: ["sorobanFunctionContractQuery"],
    },
  ],
  hourly_soroban_fee_agg_contract: [
    {
      column: "hour_agg",
      required: true,
      owningQueries: [
        "contractQuery",
        "activeContractCountQuery",
        "sorobanFeeSummaryQuery",
        "sorobanFeeContractQuery",
      ],
    },
    {
      column: "contract_id",
      required: true,
      owningQueries: [
        "contractQuery",
        "activeContractCountQuery",
        "sorobanFeeContractQuery",
      ],
    },
    {
      column: "txn_count",
      required: true,
      owningQueries: [
        "contractQuery",
        "sorobanFeeSummaryQuery",
        "sorobanFeeContractQuery",
      ],
    },
    {
      column: "total_fee_charged",
      required: false,
      owningQueries: ["sorobanFeeSummaryQuery", "sorobanFeeContractQuery"],
    },
    {
      column: "total_non_refundable_resource_fee",
      required: false,
      owningQueries: ["sorobanFeeSummaryQuery", "sorobanFeeContractQuery"],
    },
  ],
  accounts_current: [
    {
      column: "account_id",
      required: true,
      owningQueries: ["accountMetadataQuery"],
    },
    {
      column: "home_domain",
      required: true,
      owningQueries: ["accountMetadataQuery"],
    },
  ],
};

function extractPresentFields(tableEntries) {
  const present = new Set();
  if (!Array.isArray(tableEntries)) return present;
  for (const item of tableEntries) {
    if (typeof item === "string") {
      present.add(item);
    } else if (item && typeof item === "object") {
      if (typeof item.field_path === "string" && item.field_path) {
        present.add(item.field_path);
      }
      if (typeof item.column_name === "string" && item.column_name) {
        present.add(item.column_name);
      }
    }
  }
  return present;
}

export function verifyHubbleColumnContract(
  schemaSnapshot,
  contract = HUBBLE_COLUMN_CONTRACT,
) {
  const tables =
    schemaSnapshot && typeof schemaSnapshot === "object" && schemaSnapshot.tables
      ? schemaSnapshot.tables
      : (schemaSnapshot ?? {});

  const missingRequired = [];
  const missingOptional = [];
  let checkedCount = 0;

  for (const [tableName, rules] of Object.entries(contract)) {
    const present = extractPresentFields(tables[tableName]);
    for (const rule of rules) {
      checkedCount++;
      if (!present.has(rule.column)) {
        const entry = {
          table: tableName,
          column: rule.column,
          required: rule.required,
          owningQueries: [...rule.owningQueries],
        };
        if (rule.required) {
          missingRequired.push(entry);
        } else {
          missingOptional.push(entry);
        }
      }
    }
  }

  return {
    ok: missingRequired.length === 0,
    checkedCount,
    tableCount: Object.keys(contract).length,
    missingRequired,
    missingOptional,
  };
}

export function verifyContractDocSync(
  markdownSource,
  contract = HUBBLE_COLUMN_CONTRACT,
) {
  const undocumented = [];
  for (const [tableName, rules] of Object.entries(contract)) {
    if (!markdownSource.includes(tableName)) {
      undocumented.push(`Table ${tableName} is missing from docs/hubble-column-contract.md`);
    }
    for (const rule of rules) {
      if (!markdownSource.includes(`\`${rule.column}\``)) {
        undocumented.push(
          `Column ${tableName}.${rule.column} is missing from docs/hubble-column-contract.md`,
        );
      }
    }
  }
  return undocumented;
}

export function formatContractSummary(result, options = {}) {
  const mode = options.mode ?? "dry-run";
  const lines = [];

  if (options.skipped) {
    lines.push("### Hubble Column Contract Check: Skipped (Neutral)");
    lines.push("");
    lines.push(options.reason ?? "Skipped.");
    return lines.join("\n");
  }

  if (result.ok) {
    lines.push(
      `### Hubble Column Contract Check: PASS (${mode})`,
    );
    lines.push("");
    lines.push(
      `Verified **${result.checkedCount}** contracted columns across **${result.tableCount}** Hubble tables.`,
    );
  } else {
    lines.push(
      `### Hubble Column Contract Check: FAIL (${mode})`,
    );
    lines.push("");
    lines.push(
      `Detected **${result.missingRequired.length}** missing required column(s):`,
    );
    lines.push("");
    for (const item of result.missingRequired) {
      lines.push(
        `- \`${item.table}.${item.column}\` → breaks owning queries: ${item.owningQueries.map((q) => `\`${q}\``).join(", ")}`,
      );
    }
  }

  if (result.missingOptional.length > 0) {
    lines.push("");
    lines.push("#### Optional column warnings (soft-fail):");
    for (const item of result.missingOptional) {
      lines.push(
        `- \`${item.table}.${item.column}\` (optional) → readers: ${item.owningQueries.map((q) => `\`${q}\``).join(", ")}`,
      );
    }
  }

  return lines.join("\n");
}

function writeStepSummary(summary, env = process.env) {
  const summaryPath = env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  try {
    appendFileSync(summaryPath, `${summary}\n`, "utf8");
  } catch {
    // Ignore summary write errors outside GitHub Actions.
  }
}

async function fetchLiveSchemaSnapshot(env = process.env) {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const keyBase64 = env.GCP_SERVICE_ACCOUNT_KEY;
  let client;
  if (keyBase64) {
    const credentials = JSON.parse(
      Buffer.from(keyBase64, "base64").toString("utf8"),
    );
    client = new BigQuery({
      projectId: credentials.project_id,
      credentials,
    });
  } else {
    client = new BigQuery({
      projectId: env.GCP_PROJECT_ID ?? "stellar-501912",
    });
  }

  const tableNames = Object.keys(HUBBLE_COLUMN_CONTRACT);
  const sql = `
    SELECT table_name, column_name, field_path, data_type
    FROM \`${HUBBLE_DATASET}.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\`
    WHERE table_name IN UNNEST(@tables)
    ORDER BY table_name, field_path
  `;

  const [rows] = await client.query({
    query: sql,
    params: { tables: tableNames },
  });

  const tables = Object.fromEntries(tableNames.map((name) => [name, []]));
  for (const row of rows) {
    if (!tables[row.table_name]) {
      tables[row.table_name] = [];
    }
    tables[row.table_name].push({
      column_name: row.column_name,
      field_path: row.field_path,
      data_type: row.data_type,
    });
  }

  return {
    dataset: HUBBLE_DATASET,
    recordedAt: new Date().toISOString(),
    tables,
  };
}

export async function runHubbleColumnContractCli(
  argv = process.argv.slice(2),
  env = process.env,
) {
  const skipFlag =
    argv.includes("--skip") ||
    env.SKIP_HUBBLE_SCHEMA_CHECK === "1" ||
    env.SKIP_HUBBLE_SCHEMA_CHECK === "true";

  if (skipFlag) {
    const summary = formatContractSummary(null, {
      skipped: true,
      reason:
        "Skipped Hubble column contract check via SKIP_HUBBLE_SCHEMA_CHECK or --skip flag.",
    });
    console.log(summary);
    writeStepSummary(summary, env);
    return { status: 0, skipped: true, summary };
  }

  const fixtureFlagIndex = argv.indexOf("--fixture");
  const isDryRun = argv.includes("--dry-run") || fixtureFlagIndex !== -1;
  const fixturePath =
    fixtureFlagIndex !== -1 &&
    argv[fixtureFlagIndex + 1] &&
    !argv[fixtureFlagIndex + 1].startsWith("--")
      ? argv[fixtureFlagIndex + 1]
      : "scripts/fixtures/hubble-information-schema.json";

  const docPath = resolve("docs/hubble-column-contract.md");
  const docErrors = verifyContractDocSync(readFileSync(docPath, "utf8"));
  if (docErrors.length > 0) {
    const message = `docs/hubble-column-contract.md is out of sync:\n${docErrors.map((e) => `- ${e}`).join("\n")}`;
    console.error(message);
    return { status: 1, skipped: false, summary: message };
  }

  let snapshot;
  let mode;

  if (isDryRun) {
    const resolvedFixture = resolve(fixturePath);
    snapshot = JSON.parse(readFileSync(resolvedFixture, "utf8"));
    mode = `dry-run (${fixturePath})`;
  } else {
    const hasSecrets = Boolean(
      env.GCP_SERVICE_ACCOUNT_KEY || env.GOOGLE_APPLICATION_CREDENTIALS,
    );
    if (!hasSecrets) {
      const summary = formatContractSummary(null, {
        skipped: true,
        reason:
          "No GCP credentials configured (`GCP_SERVICE_ACCOUNT_KEY` / `GOOGLE_APPLICATION_CREDENTIALS` absent); skipping live INFORMATION_SCHEMA check with neutral status.",
      });
      console.log(summary);
      writeStepSummary(summary, env);
      return { status: 0, skipped: true, summary };
    }
    snapshot = await fetchLiveSchemaSnapshot(env);
    mode = "live BigQuery INFORMATION_SCHEMA";
  }

  const result = verifyHubbleColumnContract(snapshot);
  const summary = formatContractSummary(result, { mode });

  if (result.ok) {
    console.log(summary);
    writeStepSummary(summary, env);
    return { status: 0, skipped: false, result, summary };
  }

  console.error(summary);
  writeStepSummary(summary, env);
  return { status: 1, skipped: false, result, summary };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runHubbleColumnContractCli().then(({ status }) => {
    if (status !== 0) {
      process.exitCode = status;
    }
  });
}
