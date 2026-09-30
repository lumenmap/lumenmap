"use client";

import { useState } from "react";
import Image from "next/image";
import {
  DashboardProvider,
  useDashboard,
} from "@/components/dashboard/DashboardProvider";
import { CategoryShareChart } from "@/components/dashboard/CategoryShareChart";
import { DetailPanel } from "@/components/dashboard/DetailPanel";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { FreshnessWarning } from "@/components/dashboard/FreshnessWarning";
import { FixtureOnboarding } from "@/components/dashboard/FixtureOnboarding";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { NetworkTreemap } from "@/components/dashboard/NetworkTreemap";
import { FlowView } from "@/components/dashboard/FlowView";
import { ProtocolBarChart } from "@/components/dashboard/ProtocolBarChart";

import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";

import { TemporalPatternsDisclosure } from "@/components/dashboard/TemporalPatternsDisclosure";
import { AssetVolumePanel } from "@/components/dashboard/AssetVolumePanel";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { ComparisonPanel } from "@/components/dashboard/ComparisonPanel";
import { SavedViewsControls } from "@/components/dashboard/SavedViewsControls";
import { NetworkSelector } from "@/components/dashboard/NetworkSelector";
import { FlowView } from "@/components/dashboard/FlowView";
import {
  isMetricSupportedOnNetwork,
  networkLabel,
  unsupportedMetricMessage,
} from "@/lib/network";

function DashboardContent() {
  const { selectedNode, network, metric, setMetric, period } = useDashboard();
  const [showFlow, setShowFlow] = useState(false);
  const [flowAccount, setFlowAccount] = useState<string | null>(null);
  const metricSupported = isMetricSupportedOnNetwork(metric, network);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-6 overflow-x-hidden px-3 py-6 sm:px-6 lg:px-8">
      <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Image
              src="/logo.png"
              alt="LumenMap"
              width={44}
              height={44}
              className="shrink-0"
              priority
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                LumenMap
              </h1>
              <p className="text-sm text-zinc-400">
                Stellar network activity across {networkLabel(network).toLowerCase()}.
              </p>
            </div>
            <NetworkSelector />
          </div>
          <FreshnessIndicator />
          <p className="text-xs text-zinc-500">
            <a
              href="/methodology"
              className="text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
            >
              Metric methodology
            </a>
            {" · "}definitions on each KPI
          </p>
        </div>
        <div className="min-w-0 shrink-0">
          <PeriodSelector />
        </div>
      </header>

      <FreshnessWarning />

      <FixtureOnboarding />

      <SavedViewsControls />

      <div role="group" aria-label="Dashboard view" className="flex gap-2">
        <button
          type="button"
          aria-pressed={!showFlow}
          onClick={() => setShowFlow(false)}
          className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white aria-pressed:bg-white/10"
        >
          Overview
        </button>
        <button
          type="button"
          aria-pressed={showFlow}
          onClick={() => { setFlowAccount(null); setShowFlow(true); }}
          className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white aria-pressed:bg-white/10"
        >
          Flow
        </button>
      </div>

      {showFlow ? (
        <FlowView
          key={`${period}:${network}:${flowAccount ?? "overview"}`}
          account={flowAccount}
          onAccountChange={setFlowAccount}
        />
      ) : (
        <>
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

          <DashboardSearch />
          <KpiCards />
          <ComparisonPanel />
          <AssetVolumePanel />
          <CategoryShareChart />

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
                <DetailPanel onViewFlow={(account) => { setFlowAccount(account); setShowFlow(true); }} />
              </div>
            )}
          </div>

          <ProtocolBarChart />
          <ActivityHeatmap />
          <TimeSeriesChart />
          <HourOfWeekHeatmap />
        </>
      )}
    </div>
  );
}

export function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
