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
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
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
      </header>

      {/* ── 2. Primary controls (metric + period) ───────────────────────── */}
      <ControlBar />

      {/* ── 3. Primary visualization ────────────────────────────────────── */}
      {/*
        Full-width treemap dominates the initial viewport.
        Detail panel is placed in the secondary context section below
        so it does not compete with the primary visualization.
      */}
      <section aria-labelledby="treemap-heading">
        <h2
          id="treemap-heading"
          className="mb-4 text-lg font-semibold text-white"
        >
          Network Activity
        </h2>
        <NetworkTreemap />
      </section>

      {/* ── 4. Secondary context: details + KPIs + methodology ──────────── */}
      {/*
        Layout:
          • Mobile: detail panel first (user sees selection immediately),
            then KPIs, then data-source notice (stacked).
          • Desktop: KPIs + notice on the left, detail panel on the right.
        The detail panel appears before KPIs on mobile so the user can act
        on a selection without scrolling past KPI cards first.
      */}
      <section aria-labelledby="details-heading">
        <h2
          id="details-heading"
          className="mb-4 text-lg font-semibold text-white"
        >
          Details & Metrics
        </h2>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_320px]">
          {/* Detail panel – first on mobile (order-1), right column on desktop (order-2) */}
          <div className="order-1 lg:order-2">
            <DetailPanel />
          </div>

          {/* KPIs + methodology – second on mobile (order-2), left column on desktop (order-1) */}
          <div className="order-2 lg:order-1 flex flex-col gap-6">
            <KpiCards />
            <DataSourceNotice />
          </div>
        </div>
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
