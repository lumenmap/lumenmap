import { queryRegistry } from "./shared-queries.mjs";

export type HubbleTableContract = {
  table: string;
  requiredColumns: readonly string[];
  optionalColumns: readonly string[];
};

export const HUBBLE_COLUMN_CONTRACT: Record<string, HubbleTableContract> = {
  enriched_history_operations: {
    table: "enriched_history_operations",
    requiredColumns: [
      "closed_at",
      "type_string",
      "amount",
      "asset_type",
      "asset_code",
      "asset_issuer",
      "source_asset_type",
      "source_asset_code",
      "source_asset_issuer",
      "source_amount",
      "dest_asset_code",
      "dest_asset_issuer",
      "dest_amount",
      "op_source_account",
      "transaction_hash",
      "transaction_id",
      "to",
      "account",
      "into",
    ],
    optionalColumns: ["details"],
  },
  enriched_history_operations_soroban: {
    table: "enriched_history_operations_soroban",
    requiredColumns: [
      "closed_at",
      "soroban_operation_type",
      "parameters_decoded",
      "contract_id",
    ],
    optionalColumns: [],
  },
  hourly_soroban_fee_agg_contract: {
    table: "hourly_soroban_fee_agg_contract",
    requiredColumns: ["hour_agg", "contract_id", "txn_count"],
    optionalColumns: [
      "total_fee_charged",
      "total_non_refundable_resource_fee",
    ],
  },
  accounts_current: {
    table: "accounts_current",
    requiredColumns: ["account_id", "home_domain"],
    optionalColumns: [],
  },
};

export type TableDriftReport = {
  table: string;
  missingRequired: string[];
  missingOptional: string[];
  status: "ok" | "degraded" | "drifted";
};

export type SchemaDriftReport = {
  ok: boolean;
  tables: Record<string, TableDriftReport>;
  missingRequiredTotal: number;
  missingOptionalTotal: number;
};

export function compareSchemaToContract(
  liveColumnsByTable: Record<string, Iterable<string>>,
  contract: Record<string, HubbleTableContract> = HUBBLE_COLUMN_CONTRACT,
): SchemaDriftReport {
  const tables: Record<string, TableDriftReport> = {};
  let missingRequiredTotal = 0;
  let missingOptionalTotal = 0;

  for (const [tableName, tableContract] of Object.entries(contract)) {
    const liveSet = new Set(
      Array.from(liveColumnsByTable[tableName] ?? [], (col) =>
        col.trim().toLowerCase(),
      ),
    );

    const missingRequired = tableContract.requiredColumns.filter(
      (col) => !liveSet.has(col.toLowerCase()),
    );
    const missingOptional = tableContract.optionalColumns.filter(
      (col) => !liveSet.has(col.toLowerCase()),
    );

    missingRequiredTotal += missingRequired.length;
    missingOptionalTotal += missingOptional.length;

    const status: TableDriftReport["status"] =
      missingRequired.length > 0
        ? "drifted"
        : missingOptional.length > 0
          ? "degraded"
          : "ok";

    tables[tableName] = {
      table: tableName,
      missingRequired,
      missingOptional,
      status,
    };
  }

  return {
    ok: missingRequiredTotal === 0,
    tables,
    missingRequiredTotal,
    missingOptionalTotal,
  };
}

export function buildInformationSchemaQuery(
  dataset = "crypto-stellar.crypto_stellar_dbt",
  tableNames: readonly string[] = Object.keys(HUBBLE_COLUMN_CONTRACT),
): { sql: string; params: { tables: string[] } } {
  return {
    sql: `
SELECT table_name, column_name, data_type
FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name IN UNNEST(@tables)
ORDER BY table_name, ordinal_position
`.trim(),
    params: { tables: [...tableNames] },
  };
}

export function verifyQueryRegistryTablesAgainstContract(
  registry: ReadonlyArray<{ name: string; sql: string }> = queryRegistry,
  contract: Record<string, HubbleTableContract> = HUBBLE_COLUMN_CONTRACT,
): { ok: boolean; unknownTables: Array<{ queryName: string; table: string }> } {
  const unknownTables: Array<{ queryName: string; table: string }> = [];
  const tableRegex =
    /crypto-stellar\.crypto_stellar_dbt\.([a-zA-Z0-9_]+)/g;

  for (const entry of registry) {
    for (const match of entry.sql.matchAll(tableRegex)) {
      const table = match[1];
      if (table && !contract[table]) {
        unknownTables.push({ queryName: entry.name, table });
      }
    }
  }

  return {
    ok: unknownTables.length === 0,
    unknownTables,
  };
}
