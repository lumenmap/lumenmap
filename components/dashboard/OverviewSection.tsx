// OverviewSection.tsx
"use client";

import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { ComparisonPanel } from "@/components/dashboard/ComparisonPanel";
import { AssetVolumePanel } from "@/components/dashboard/AssetVolumePanel";
import { LiquidityFlowPanel } from "@/components/dashboard/LiquidityFlowPanel";
import { CategoryShareChart } from "@/components/dashboard/CategoryShareChart";
import { SavedViewsControls } from "@/components/dashboard/SavedViewsControls";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { FreshnessWarning } from "@/components/dashboard/FreshnessWarning";
import { isMetricSupportedOnNetwork, unsupportedMetricMessage } from "@/lib/network";
import { ChartDeepLink } from "@/components/dashboard/ChartDeepLink";

export function OverviewSection() {
  const { network, metric, setMetric } = useDashboard();
  const metricSupported = isMetricSupportedOnNetwork(metric, network);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-8">
      <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Header logo etc can be added here if needed */}
          </div>
          <FreshnessIndicator />
          <p className="text-xs text-zinc-500">
            <a href="/methodology" className="text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm">
              Metric methodology
            </a>{" · "}definitions on each KPI
          </p>
        </div>
        <div className="min-w-0 shrink-0">
          <PeriodSelector />
        </div>
      </header>

      <FreshnessWarning />
      <SavedViewsControls />

      {!metricSupported && (
        <div role="status" className="rounded-lg border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          <p>{unsupportedMetricMessage(metric)}</p>
          <button type="button" className="mt-2 text-sm font-medium text-amber-50 underline" onClick={() => setMetric("ops")}>Switch to operations</button>
        </div>
      )}

      <DashboardSearch />
      <KpiCards />
      <ChartDeepLink id="period-comparison" label="period comparison"><ComparisonPanel /></ChartDeepLink>
      <ChartDeepLink id="asset-volume-chart" label="payment volume by asset"><AssetVolumePanel /></ChartDeepLink>
      <ChartDeepLink id="liquidity-routing-chart" label="liquidity routing"><LiquidityFlowPanel /></ChartDeepLink>
      <ChartDeepLink id="category-share-chart" label="category share"><CategoryShareChart /></ChartDeepLink>
    </div>
  );
}
