import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HUBBLE_COLUMN_CONTRACT,
  buildInformationSchemaQuery,
  compareSchemaToContract,
  verifyQueryRegistryTablesAgainstContract,
} from "./schema-drift";

describe("Hubble schema-drift checker", () => {
  it("passes when all required and optional columns exist", () => {
    const fullSchema = Object.fromEntries(
      Object.entries(HUBBLE_COLUMN_CONTRACT).map(([table, contract]) => [
        table,
        [...contract.requiredColumns, ...contract.optionalColumns],
      ]),
    );
    const report = compareSchemaToContract(fullSchema);
    assert.equal(report.ok, true);
    assert.equal(report.missingRequiredTotal, 0);
    assert.equal(report.missingOptionalTotal, 0);
  });

  it("marks table degraded (but ok=true) when only optional Soroban fee columns are absent", () => {
    const schemaWithoutOptional = Object.fromEntries(
      Object.entries(HUBBLE_COLUMN_CONTRACT).map(([table, contract]) => [
        table,
        [...contract.requiredColumns],
      ]),
    );
    const report = compareSchemaToContract(schemaWithoutOptional);
    assert.equal(report.ok, true);
    assert.equal(
      report.tables.hourly_soroban_fee_agg_contract?.status,
      "degraded",
    );
    assert.deepEqual(
      report.tables.hourly_soroban_fee_agg_contract?.missingOptional,
      ["total_fee_charged", "total_non_refundable_resource_fee"],
    );
  });

  it("fails with status=drifted when a required column disappears upstream", () => {
    const driftedSchema = Object.fromEntries(
      Object.entries(HUBBLE_COLUMN_CONTRACT).map(([table, contract]) => [
        table,
        contract.requiredColumns.filter((col) => col !== "type_string"),
      ]),
    );
    const report = compareSchemaToContract(driftedSchema);
    assert.equal(report.ok, false);
    assert.equal(
      report.tables.enriched_history_operations?.status,
      "drifted",
    );
    assert.deepEqual(
      report.tables.enriched_history_operations?.missingRequired,
      ["type_string"],
    );
  });

  it("verifies all tables referenced in queryRegistry are covered by HUBBLE_COLUMN_CONTRACT", () => {
    const check = verifyQueryRegistryTablesAgainstContract();
    assert.equal(check.ok, true);
    assert.deepEqual(check.unknownTables, []);

    const infoQuery = buildInformationSchemaQuery();
    assert.ok(infoQuery.sql.includes("INFORMATION_SCHEMA.COLUMNS"));
    assert.equal(infoQuery.params.tables.length, 4);
  });
});
