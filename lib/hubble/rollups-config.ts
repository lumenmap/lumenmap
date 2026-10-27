/**
 * Configuration for scheduled BigQuery materialized rollups.
 */

const DEFAULT_ROLLUPS_DATASET = "lumenmap_rollups";

/**
 * Checks whether reading from scheduled BigQuery materialized rollups is enabled.
 * Controlled by `LUMENMAP_USE_ROLLUPS` (true / 1).
 * Defaults to false (falls back to live SQL).
 */
export function isRollupEnabled(): boolean {
  const envVal = process.env.LUMENMAP_USE_ROLLUPS?.trim().toLowerCase();
  return envVal === "true" || envVal === "1";
}

/**
 * Resolves the dataset where materialized rollup tables/views reside.
 * Controlled by `LUMENMAP_ROLLUPS_DATASET` (defaults to 'lumenmap_rollups').
 */
export function resolveRollupsDataset(): string {
  const custom = process.env.LUMENMAP_ROLLUPS_DATASET?.trim();
  return custom && custom.length > 0 ? custom : DEFAULT_ROLLUPS_DATASET;
}
