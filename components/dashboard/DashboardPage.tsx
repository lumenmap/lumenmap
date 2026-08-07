"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { DashboardProvider, useDashboard } from "@/components/dashboard/DashboardProvider";
import { CategoryShareChart } from "@/components/dashboard/CategoryShareChart";
import { DetailPanel } from "@/components/dashboard/DetailPanel";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { FreshnessWarning } from "@/components/dashboard/FreshnessWarning";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { NetworkTreemap } from "@/components/dashboard/NetworkTreemap";
import { ProtocolBarChart } from "@/components/dashboard/ProtocolBarChart";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";

function DashboardContent() {
  const { selectedNode } = useDashboard();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Image
              src="/logo.png"
              alt="LumenMap"
              width={44}
              height={44}
              className="shrink-0"
              priority
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                LumenMap
              </h1>
              <p className="text-sm text-zinc-400">
                Stellar network activity across mainnet.
              </p>
            </div>
            <Badge>Mainnet</Badge>
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
        <PeriodSelector />
      </header>

      <FreshnessWarning />

      <DashboardSearch />

      <KpiCards />

      <CategoryShareChart />

      <div
        className={`grid grid-cols-1 gap-6 transition-all duration-300 ${
          selectedNode
            ? "min-w-0 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]"
            : "min-w-0 xl:grid-cols-1"
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

      <ProtocolBarChart />
      <TimeSeriesChart />
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
