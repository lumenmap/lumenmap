"use client";

import { format } from "date-fns";
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

function DataSourceNotice() {
  const { data } = useDashboard();

  if (!data) {
    return null;
  }

  const sourceTime = data.sourceTimestamp
    ? new Date(data.sourceTimestamp)
    : null;
  const periodEnd = new Date(data.end);
  const isBehind = sourceTime && periodEnd > sourceTime;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-zinc-500">
        Data source:{" "}
        <span className="text-zinc-300">Hubble BigQuery</span>
        {sourceTime
          ? ` · Latest data: ${format(sourceTime, "MMM d, yyyy HH:mm UTC")}`
          : ""}
      </p>
      {!data.isPeriodComplete && (
        <p className="text-xs text-amber-400">
          {data.period === "1d"
            ? "Today's data is still being indexed and may be incomplete."
            : "This period is still accumulating data and may be incomplete."}
        </p>
      )}
      {isBehind && (
        <p className="text-xs text-zinc-400">
          Latest available data may be delayed relative to the period
          end
        </p>
      )}
    </div>
  );
}

function DashboardContent() {
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
