"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  DashboardProvider,
  useDashboard,
} from "@/components/dashboard/DashboardProvider";
import { ControlBar } from "@/components/dashboard/ControlBar";
import { DetailPanel } from "@/components/dashboard/DetailPanel";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { NetworkTreemap } from "@/components/dashboard/NetworkTreemap";

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
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* ── 1. Site header (h1) ─────────────────────────────────────────── */}
      <header>
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
        <div className="mt-3">
          <DataSourceNotice />
        </div>
      </header>

      {/* ── 2. Primary controls (metric view + period) ──────────────────── */}
      <ControlBar />

      {/* ── 3. Primary visualization + detail sidebar (desktop) ─────────── */}
      {/*
        Layout:
          • Mobile:  treemap → detail panel → KPI cards (stacked)
          • Desktop: [treemap  |  detail sidebar]  then KPI cards full-width below
        The detail panel appears directly below the treemap on mobile so the
        user can act on a selection without scrolling past KPIs first.
      */}
      <section aria-labelledby="treemap-heading">
        <h2 id="treemap-heading" className="sr-only">
          Network activity treemap
        </h2>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Treemap always renders first in DOM order (keyboard / screen reader) */}
          <NetworkTreemap />

          {/* Detail panel – sidebar on desktop, stacked below treemap on mobile */}
          <DetailPanel />
        </div>
      </section>

      {/* ── 4. Secondary context: KPI summary cards ─────────────────────── */}
      <section aria-labelledby="kpis-heading">
        <h2 id="kpis-heading" className="sr-only">
          Key metrics
        </h2>
        <KpiCards />
      </section>
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
