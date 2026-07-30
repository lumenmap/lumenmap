"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  DashboardProvider,
  useDashboard,
} from "@/components/dashboard/DashboardProvider";
import { DetailPanel } from "@/components/dashboard/DetailPanel";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { NetworkTreemap } from "@/components/dashboard/NetworkTreemap";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { WeekHourHeatmap } from "@/components/dashboard/WeekHourHeatmap";

function DataSourceNotice() {
  const { data } = useDashboard();

  if (!data) {
    return null;
  }

  return (
    <p className="text-xs text-zinc-500">
      Data source:{" "}
      <span className="text-zinc-300">Hubble BigQuery</span>
      {" · Hubble updates in intraday batches"}
    </p>
  );
}

function DashboardContent() {
  const { data, isLoading } = useDashboard();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
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
          <DataSourceNotice />
        </div>
        <PeriodSelector />
      </header>

      <KpiCards />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <NetworkTreemap />
        <DetailPanel />
      </div>

      <WeekHourHeatmap
        data={data?.weekHourActivity ?? []}
        isLoading={isLoading}
      />
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
