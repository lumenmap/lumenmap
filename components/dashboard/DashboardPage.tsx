"use client";

import Image from "next/image";
import { useDashboard, DashboardProvider } from "@/components/dashboard/DashboardProvider";
import { CategoryShareChart } from "@/components/dashboard/CategoryShareChart";
import { DetailPanel } from "@/components/dashboard/DetailPanel";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { FreshnessWarning } from "@/components/dashboard/FreshnessWarning";
import { ActivityErrorBanner } from "@/components/dashboard/ActivityErrorState";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { FlowEgoSection } from "@/components/dashboard/FlowEgoSection";
import { NetworkTreemap } from "@/components/dashboard/NetworkTreemap";
import { FlowView } from "@/components/dashboard/FlowView";
import { ProtocolBarChart } from "@/components/dashboard/ProtocolBarChart";

import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { HourOfWeekHeatmap } from "@/components/dashboard/HourOfWeekHeatmap";

import { TemporalPatternsDisclosure } from "@/components/dashboard/TemporalPatternsDisclosure";
import { AssetVolumePanel } from "@/components/dashboard/AssetVolumePanel";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { ComparisonPanel } from "@/components/dashboard/ComparisonPanel";
import { SavedViewsControls } from "@/components/dashboard/SavedViewsControls";
import { NetworkSelector } from "@/components/dashboard/NetworkSelector";
import { TabbedSection } from "@/components/ui/tabbed-section";
import {
  isMetricSupportedOnNetwork,
  networkLabel,
  unsupportedMetricMessage,
} from "@/lib/network";

function DashboardContent() {
  const { selectedNode, network, metric, setMetric, period } = useDashboard();
  const metricSupported = isMetricSupportedOnNetwork(metric, network);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-6 overflow-x-hidden px-3 py-6 sm:px-6 lg:px-8">
      {/* Compact header */}
      <header className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="LumenMap"
            width={36}
            height={36}
            className="shrink-0"
            priority
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              LumenMap
            </h1>
            <p className="text-xs text-zinc-400">
              {networkLabel(network).toLowerCase()}
            </p>
          </div>
          <NetworkSelector />
        </div>
        <div className="flex items-center gap-3">
          <FreshnessIndicator />
          <PeriodSelector />
        </div>
      </header>

      <FreshnessWarning />

      <ActivityErrorBanner />

      <SavedViewsControls />

      {!metricSupported && (
        <div
          role="status"
          className="rounded-lg border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
        >
          <p>{unsupportedMetricMessage(metric)}</p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-amber-50 underline"
            onClick={() => setMetric("ops")}
          >
            Switch to operations
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardSearch />
        <SavedViewsControls />
      </div>

      {/* KPIs - quick overview */}
      <KpiCards />

      {/* Primary visualization */}
      <div
        className={`grid min-w-0 grid-cols-1 gap-6 transition-all duration-300 ${
          selectedNode
            ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]"
            : "xl:grid-cols-1"
        }`}
      >
        <div className="min-w-0">
          <NetworkTreemap />
        </div>
        {selectedNode && (
          <div className="min-w-0 scroll-mt-4" id="detail-panel-container">
            <DetailPanel />
          </div>
        )}
      </div>

      {/* Supporting charts - tabbed section */}
      <TabbedSection
        tabs={[
          {
            id: "volume",
            label: "Volume & Category",
            content: (
              <div className="flex flex-col gap-6">
                <AssetVolumePanel />
                <CategoryShareChart />
              </div>
            ),
          },
          {
            id: "activity",
            label: "Activity Analysis",
            content: (
              <div className="flex flex-col gap-6">
                <ProtocolBarChart />
                <ActivityHeatmap />
                <TimeSeriesChart />
                <HourOfWeekHeatmap />
              </div>
            ),
          },
          {
            id: "comparisons",
            label: "Comparisons",
            content: <ComparisonPanel />,
          },
        ] as const}
        defaultTab="volume"
      />

      {/* Methodology link */}
      <p className="text-center text-xs text-zinc-500">
        <a
          href="/methodology"
          className="text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
        >
          Metric methodology
        </a>
        {" · "}definitions on each KPI
      </p>
    </div>
  );
}

export function DashboardPage({
  flowViewEnabled = false,
}: {
  /** Flow feature flag resolved in the server component. */
  flowViewEnabled?: boolean;
} = {}) {
  return (
    <DashboardProvider flowViewEnabled={flowViewEnabled}>
      <DashboardContent />
    </DashboardProvider>
  );
}
