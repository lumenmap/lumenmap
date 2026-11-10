"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import {
  buildTrustlineVelocityFixture,
  type TrustlineVelocitySummary,
} from "@/lib/metrics/trustline-velocity";
import { formatExactNumber } from "@/lib/utils";

export function TrustlineVelocityChart({
  summary: explicitSummary,
}: {
  summary?: TrustlineVelocitySummary;
} = {}) {
  const { period } = useDashboard();
  const summary = useMemo(
    () => explicitSummary ?? buildTrustlineVelocityFixture(period),
    [explicitSummary, period],
  );

  if (summary.status === "unavailable") {
    return (
      <Card data-testid="trustline-velocity-chart">
        <CardHeader>
          <CardTitle>Trustline Creation &amp; Removal Velocity</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            role="status"
            data-testid="trustline-velocity-unavailable"
            className="text-sm text-zinc-400"
          >
            {summary.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxBucketValue = Math.max(
    1,
    ...summary.buckets.map((b) => Math.max(b.createdCount, b.removedCount)),
  );
  const netSign = summary.netTrustlineChange >= 0 ? "+" : "";

  return (
    <Card data-testid="trustline-velocity-chart">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Trustline Creation &amp; Removal Velocity</CardTitle>
            <p className="text-xs text-zinc-400">
              UTC bucket breakdown of <code className="font-mono">change_trust</code> creations (<code className="font-mono">limit &gt; 0</code>) vs removals (<code className="font-mono">limit = 0</code>).
            </p>
          </div>
          <div
            data-testid="trustline-net-kpi"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right"
          >
            <p className="text-[11px] text-zinc-400">Net trustline change</p>
            <p className="font-mono text-sm font-semibold text-emerald-300">
              {netSign}
              {formatExactNumber(summary.netTrustlineChange)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded border border-white/10 bg-black/20 p-2.5">
            <p className="text-xs text-zinc-400">Created</p>
            <p
              data-testid="trustline-total-created"
              className="mt-0.5 font-mono text-sm text-emerald-300"
            >
              {formatExactNumber(summary.totalCreated)} ops
            </p>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2.5">
            <p className="text-xs text-zinc-400">Removed</p>
            <p
              data-testid="trustline-total-removed"
              className="mt-0.5 font-mono text-sm text-rose-300"
            >
              {formatExactNumber(summary.totalRemoved)} ops
            </p>
          </div>
          <div className="col-span-2 rounded border border-white/10 bg-black/20 p-2.5 sm:col-span-1">
            <p className="text-xs text-zinc-400">UTC buckets</p>
            <p className="mt-0.5 font-mono text-sm text-zinc-200">
              {summary.buckets.length} ({summary.period})
            </p>
          </div>
        </div>

        <div
          className="space-y-2 overflow-x-auto"
          role="region"
          aria-label="Trustline creation and removal UTC buckets"
        >
          {summary.buckets.map((bucket) => {
            const createWidthPct = Math.max(
              4,
              Math.round((bucket.createdCount / maxBucketValue) * 100),
            );
            const removeWidthPct = Math.max(
              4,
              Math.round((bucket.removedCount / maxBucketValue) * 100),
            );
            const bucketSign = bucket.netChange >= 0 ? "+" : "";
            return (
              <div
                key={bucket.bucketUtc}
                data-testid="trustline-velocity-bucket"
                className="rounded-lg border border-white/5 bg-black/20 p-2.5 text-xs"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span className="text-zinc-300">{bucket.bucketUtc}</span>
                  <span className="text-zinc-400">
                    +{formatExactNumber(bucket.createdCount)} / -
                    {formatExactNumber(bucket.removedCount)} (net {bucketSign}
                    {formatExactNumber(bucket.netChange)})
                  </span>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-2 rounded bg-emerald-400/75"
                    style={{ width: `${createWidthPct}%` }}
                    title={`Created: ${bucket.createdCount}`}
                  />
                  <div
                    className="h-2 rounded bg-rose-400/75"
                    style={{ width: `${removeWidthPct}%` }}
                    title={`Removed: ${bucket.removedCount}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-zinc-500">
          Trustline creations and removals are derived from{" "}
          <code className="font-mono">change_trust</code> limit semantics.{" "}
          <a
            href={summary.methodologyHref}
            className="text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
          >
            Category methodology
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
