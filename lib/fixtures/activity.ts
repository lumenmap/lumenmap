import {
  buildAllTreemaps,
  buildKpis,
  buildProtocolSummary,
} from "@/lib/entities/build-treemap";
import {
  getFixturePreviousRawActivity,
  getFixtureRawActivity,
} from "@/lib/fixtures/raw-data";
import {
  getFixtureActiveDestinationCount,
  getFixtureActiveWalletCount,
  getFixtureTimeseries,
} from "@/lib/fixtures/timeseries";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type { DashboardNetworkId } from "@/lib/network";
import { resolveDashboardNetwork } from "@/lib/network";
import { previousPeriodAnchor, resolvePeriod } from "@/lib/periods";
import type { ActivityDataset, ActivityWindow, Period } from "@/lib/types";

/**
 * Builds a complete dashboard payload from the deterministic fixture rows.
 * The fixture goes through the same KPI and treemap builders as live
 * BigQuery data, so fixture mode exercises the real rendering pipeline.
 *
 * Used when `LUMENMAP_DATA_SOURCE=fixture` (local development and the
 * Playwright e2e suite). Requires no GCP credentials and performs no
 * network calls: labels resolve from the local entity registry only.
 *
 * Pass `network` (or set `LUMENMAP_NETWORK=testnet`) to simulate testnet
 * provenance metadata without changing fixture row values.
 */
export function getFixtureActivityData(
  period: Period,
  network: DashboardNetworkId = resolveDashboardNetwork(),
  window: ActivityWindow = "current",
): ActivityDataset {
  const previous = window === "prev";
  const raw = previous
    ? getFixturePreviousRawActivity(period)
    : getFixtureRawActivity(period);
  const range = previous
    ? resolvePeriod(period, previousPeriodAnchor(period))
    : resolvePeriod(period);

  return {
    period,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    source: "fixture",
    sourceTimestamp: range.end.toISOString(),
    isPeriodComplete: true,
    categories: raw.categories,
    transactionCategories: raw.transactionCategories,
    contracts: raw.contracts,
    accounts: raw.accounts,
    sorobanFunctions: raw.sorobanFunctions,
    sorobanFunctionContracts: raw.sorobanFunctionContracts,
    kpis: buildKpis(
      raw.categories,
      raw.contracts,
      [{ active_accounts: getFixtureActiveWalletCount(period) }],
      raw.contracts.length,
      getFixtureActiveDestinationCount(period),
    ),
    treemaps: buildAllTreemaps(raw),
    protocols: buildProtocolSummary(raw.accounts, raw.contracts),
    usdcPaymentVolume: {
      amount: 0,
      unit: "USDC",
      assetSetId: "stellar-mainnet-usdc-v1",
      methodology: "docs/metric-methodology.md#usdc-payment-volume",
      assets: [],
    },
    usdcCategories: [],
    usdcAccounts: [],
    // The previous window exists to diff treemap tiles; its timeseries
    // stays anchored to the active period, which the diff UI never reads.
    timeseries: getFixtureTimeseries(period),
    metricProvenance: buildActivityMetricProvenance(network),
  };
}
