import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { isRollupEnabled, resolveRollupsDataset } from "./rollups-config";
import {
  rollupCategoryQuery,
  rollupTransactionCategoryQuery,
  rollupDailyTimeseriesQuery,
  rollupActiveSourceAccountsQuery,
  rollupCategoryShareQuery,
} from "./rollup-queries";
import { categoryQuery, transactionCategoryQuery, activeSourceAccountsQuery, dailyTimeseriesQuery } from "./queries";
import { categoryShareQuery } from "./category-share";

describe("BigQuery Materialized Rollups Configuration & SQL", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.LUMENMAP_USE_ROLLUPS;
    delete process.env.LUMENMAP_ROLLUPS_DATASET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults to disabled and falls back to live SQL", () => {
    assert.equal(isRollupEnabled(), false);
    assert.equal(resolveRollupsDataset(), "lumenmap_rollups");
  });

  it("enables rollups when LUMENMAP_USE_ROLLUPS is set to true or 1", () => {
    process.env.LUMENMAP_USE_ROLLUPS = "true";
    assert.equal(isRollupEnabled(), true);

    process.env.LUMENMAP_USE_ROLLUPS = "1";
    assert.equal(isRollupEnabled(), true);

    process.env.LUMENMAP_USE_ROLLUPS = "false";
    assert.equal(isRollupEnabled(), false);

    process.env.LUMENMAP_USE_ROLLUPS = "0";
    assert.equal(isRollupEnabled(), false);
  });

  it("uses custom rollup dataset when configured", () => {
    process.env.LUMENMAP_ROLLUPS_DATASET = "my_custom_project.my_rollups";
    assert.equal(resolveRollupsDataset(), "my_custom_project.my_rollups");

    const categorySql = rollupCategoryQuery();
    assert.ok(categorySql.includes("my_custom_project.my_rollups.daily_ops_summary"));
  });

  it("generates valid rollup SQL referencing correct views and partitioning columns", () => {
    const catSql = rollupCategoryQuery("test_ds");
    assert.ok(catSql.includes("`test_ds.daily_ops_summary`"));
    assert.ok(catSql.includes("bucket_date BETWEEN DATE(@start) AND DATE(@end)"));

    const txCatSql = rollupTransactionCategoryQuery("test_ds");
    assert.ok(txCatSql.includes("`test_ds.daily_ops_summary`"));
    assert.ok(txCatSql.includes("SUM(txn_count) AS txn_count"));

    const timeseriesSql = rollupDailyTimeseriesQuery("test_ds");
    assert.ok(timeseriesSql.includes("`test_ds.daily_ops_summary`"));
    assert.ok(timeseriesSql.includes("SUM(tx_count) AS tx_count"));
    assert.ok(timeseriesSql.includes("SUM(op_count) AS op_count"));

    const activeWalletsSql = rollupActiveSourceAccountsQuery("test_ds");
    assert.ok(activeWalletsSql.includes("`test_ds.daily_active_wallets`"));
    assert.ok(activeWalletsSql.includes("COALESCE(MAX(active_accounts), 0) AS active_accounts"));

    const hourlyShare = rollupCategoryShareQuery("hour", "test_ds");
    assert.ok(hourlyShare.includes("`test_ds.category_share_hourly`"));

    const dailyShare = rollupCategoryShareQuery("day", "test_ds");
    assert.ok(dailyShare.includes("`test_ds.category_share_daily`"));
  });

  it("preserves fallback live SQL contracts when rollups are disabled", () => {
    // Assert live queries query enriched_history_operations
    assert.ok(categoryQuery.includes("crypto-stellar.crypto_stellar_dbt.enriched_history_operations"));
    assert.ok(transactionCategoryQuery.includes("crypto-stellar.crypto_stellar_dbt.enriched_history_operations"));
    assert.ok(activeSourceAccountsQuery.includes("crypto-stellar.crypto_stellar_dbt.enriched_history_operations"));
    assert.ok(dailyTimeseriesQuery.includes("crypto-stellar.crypto_stellar_dbt.enriched_history_operations"));
    assert.ok(categoryShareQuery("day").includes("crypto-stellar.crypto_stellar_dbt.enriched_history_operations"));
  });
});
