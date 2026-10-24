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
import { ProtocolHealthScorecards } from "@/components/dashboard/ProtocolHealthScorecards";

import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { HourOfWeekHeatmap } from "@/components/dashboard/HourOfWeekHeatmap";

import { TemporalPatternsDisclosure } from "@/components/dashboard/TemporalPatternsDisclosure";
import { AssetVolumePanel } from "@/components/dashboard/AssetVolumePanel";
import { SorobanFeePanel } from "@/components/dashboard/SorobanFeePanel";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { AddressComparisonPanel } from "@/components/dashboard/AddressComparisonPanel";
import { ComparisonPanel } from "@/components/dashboard/ComparisonPanel";
import { IssuerIntelligence } from "@/components/dashboard/IssuerIntelligence";
import { SavedViewsControls } from "@/components/dashboard/SavedViewsControls";
import { WatchlistPanel } from "@/components/dashboard/WatchlistPanel";
import { SnapshotBanner } from "@/components/dashboard/SnapshotBanner";
import { SnapshotShareControls } from "@/components/dashboard/SnapshotShareControls";
import { NetworkSelector } from "@/components/dashboard/NetworkSelector";
import { KeyboardShortcuts } from "@/components/dashboard/KeyboardShortcuts";
import { AnomalyBanner } from "@/components/dashboard/AnomalyBanner";
import { useEffect, useState } from "react";
import {
  detectKpiAnomalies,
  QUIET_FIXTURE,
  SPIKE_FIXTURE,
  type KpiSnapshot,
} from "@/lib/anomalies";
import { TabbedSection } from "@/components/ui/tabbed-section";
import {
  isMetricSupportedOnNetwork,
  networkLabel,
  unsupportedMetricMessage,
} from "@/lib/network";
import type { ResearchSnapshot } from "@/lib/snapshots/types";

function snapshotFromKpis(kpis: {
  totalOps: { value: number };
  activeWallets: { value: number };
  sorobanShare: { value: number };
}): KpiSnapshot {
  return {
    ops: kpis.totalOps.value,
    activeWallets: kpis.activeWallets.value,
    sorobanShare: kpis.sorobanShare.value,
  };
}

function AnomalyBannerHost() {
  const { data, comparisonData } = useDashboard();
  const [forced, setForced] = useState<string | null>(null);

  useEffect(() => {
    // Deferred so the forced-fixture read does not set state synchronously
    // during the effect body (same pattern as the URL-parse effect in
    // DashboardProvider).
    queueMicrotask(() => {
      setForced(new URLSearchParams(window.location.search).get("anomaly"));
    });
  }, []);

  if (forced === "spike") {
    return <AnomalyBanner findings={detectKpiAnomalies(SPIKE_FIXTURE)} />;
  }
  if (forced === "quiet") {
    return <AnomalyBanner findings={detectKpiAnomalies(QUIET_FIXTURE)} />;
  }

  const complete = Boolean(data?.isPeriodComplete && comparisonData?.isPeriodComplete);
  const findings = detectKpiAnomalies({
    complete,
    current: data ? snapshotFromKpis(data.kpis) : null,
    baseline: comparisonData ? snapshotFromKpis(comparisonData.kpis) : null,
  });

  return <AnomalyBanner findings={findings} />;
}

function DashboardContent() {
  const { selectedNode, network, metric, setMetric, readOnly, snapshot } =
    useDashboard();
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
          <div className={readOnly ? "pointer-events-none opacity-70" : undefined}>
            <NetworkSelector />
          </div>
          <KeyboardShortcuts />
        </div>
        <div className={`flex items-center gap-3 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
          <FreshnessIndicator />
          <PeriodSelector />
        </div>
      </header>

      {snapshot ? (
        <SnapshotBanner
          generatedAt={snapshot.generatedAt}
          detail={`${snapshot.period} · ${snapshot.metric} · ${snapshot.view}`}
        />
      ) : null}

      <FreshnessWarning />
      <AnomalyBannerHost />

      <ActivityErrorBanner />

      {readOnly ? null : <SavedViewsControls />}

      {!readOnly && !metricSupported && (
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
        {readOnly ? null : <DashboardSearch />}
        {readOnly ? null : <SavedViewsControls />}
        <SnapshotShareControls />
      </div>

      {/* KPIs - quick overview */}
      {readOnly ? null : <AddressComparisonPanel />}
      <KpiCards />

      {readOnly ? null : <WatchlistPanel />}

      <ProtocolHealthScorecards />

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
      {readOnly ? null : (
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
            id: "issuers",
            label: "Issuers",
            content: <IssuerIntelligence />,
          },
          {
            id: "comparisons",
            label: "Comparisons",
            content: (
              <div className="flex flex-col gap-6">
                <ComparisonPanel />
                <AddressComparisonPanel />
              </div>
            ),
          },
          {
            id: "soroban-fees",
            label: "Soroban fees",
            content: <SorobanFeePanel />,
          },
        ] as const}
        defaultTab="volume"
      />
      )}

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
  snapshot = null,
}: {
  /** Flow feature flag resolved in the server component. */
  flowViewEnabled?: boolean;
  /** Frozen snapshot rendered at /s/:id. Live activity is not queried. */
  snapshot?: ResearchSnapshot | null;
} = {}) {
  return (
    <DashboardProvider flowViewEnabled={flowViewEnabled} snapshot={snapshot}>
      <DashboardContent />
    </DashboardProvider>
  );
}
