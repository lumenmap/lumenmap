import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  HUBBLE_COLUMN_CONTRACT,
  formatContractSummary,
  runHubbleColumnContractCli,
  verifyContractDocSync,
  verifyHubbleColumnContract,
} from "./check-hubble-column-contract.mjs";

const fixturePath = new URL(
  "./fixtures/hubble-information-schema.json",
  import.meta.url,
);
const contractDocPath = new URL(
  "../docs/hubble-column-contract.md",
  import.meta.url,
);

test("recorded fixture schema snapshot passes all required and optional columns", () => {
  const snapshot = JSON.parse(readFileSync(fixturePath, "utf8"));
  const result = verifyHubbleColumnContract(snapshot);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingRequired, []);
  assert.deepEqual(result.missingOptional, []);
  assert.equal(result.tableCount, 4);
});

test("docs/hubble-column-contract.md documents every column in HUBBLE_COLUMN_CONTRACT", () => {
  const markdown = readFileSync(contractDocPath, "utf8");
  assert.deepEqual(verifyContractDocSync(markdown, HUBBLE_COLUMN_CONTRACT), []);
});

test("missing required column fails and maps to exact owning queries", () => {
  const snapshot = JSON.parse(readFileSync(fixturePath, "utf8"));
  snapshot.tables.enriched_history_operations =
    snapshot.tables.enriched_history_operations.filter(
      (col) => col.field_path !== "details.to" && col.field_path !== "transaction_id",
    );

  const result = verifyHubbleColumnContract(snapshot);
  assert.equal(result.ok, false);
  assert.equal(result.missingRequired.length, 2);

  const detailsTo = result.missingRequired.find(
    (entry) => entry.column === "details.to",
  );
  assert.deepEqual(detailsTo?.owningQueries, ["activeDestinationCountQuery"]);

  const txId = result.missingRequired.find(
    (entry) => entry.column === "transaction_id",
  );
  assert.deepEqual(txId?.owningQueries, ["heatmapQuery"]);

  const summary = formatContractSummary(result, { mode: "dry-run" });
  assert.match(summary, /FAIL \(dry-run\)/);
  assert.match(
    summary,
    /`enriched_history_operations\.details\.to` → breaks owning queries: `activeDestinationCountQuery`/,
  );
});

test("missing optional Soroban fee columns emit soft-fail warnings without failing check", () => {
  const snapshot = JSON.parse(readFileSync(fixturePath, "utf8"));
  snapshot.tables.hourly_soroban_fee_agg_contract =
    snapshot.tables.hourly_soroban_fee_agg_contract.filter(
      (col) => col.field_path !== "total_fee_charged",
    );

  const result = verifyHubbleColumnContract(snapshot);
  assert.equal(result.ok, true);
  assert.equal(result.missingRequired.length, 0);
  assert.equal(result.missingOptional.length, 1);
  assert.equal(result.missingOptional[0].column, "total_fee_charged");

  const summary = formatContractSummary(result, { mode: "dry-run" });
  assert.match(summary, /PASS \(dry-run\)/);
  assert.match(summary, /Optional column warnings \(soft-fail\)/);
});

test("CLI skips cleanly with neutral summary when secrets are absent or SKIP_HUBBLE_SCHEMA_CHECK is set", async () => {
  const noSecrets = await runHubbleColumnContractCli([], {});
  assert.equal(noSecrets.status, 0);
  assert.equal(noSecrets.skipped, true);
  assert.match(noSecrets.summary, /Skipped \(Neutral\)/);

  const envSkipped = await runHubbleColumnContractCli([], {
    SKIP_HUBBLE_SCHEMA_CHECK: "1",
    GCP_SERVICE_ACCOUNT_KEY: "unused",
  });
  assert.equal(envSkipped.status, 0);
  assert.equal(envSkipped.skipped, true);

  const dryRun = await runHubbleColumnContractCli(["--dry-run"], {});
  assert.equal(dryRun.status, 0);
  assert.equal(dryRun.skipped, false);
  assert.match(dryRun.summary, /PASS \(dry-run/);
});
