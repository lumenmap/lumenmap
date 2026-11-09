"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrustlineVelocitySeries } from "@/lib/charts/trustline-velocity";

export function TrustlineVelocityChart({
  series,
}: {
  series: TrustlineVelocitySeries;
}) {
  if (series.status === "unavailable" || series.buckets.length === 0) {
    return (
      <Card data-testid="trustline-velocity-unavailable">
        <CardHeader>
          <CardTitle>Trustline creation &amp; removal velocity</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="status" className="text-xs text-text-muted">
            Trustline create/remove subtype counts are unavailable for this
            period.
          </p>
        </CardContent>
      </Card>
    );
  }

  const netPrefix = series.netTrustlineChange > 0 ? "+" : "";

  return (
    <Card data-testid="trustline-velocity-chart">
      <CardHeader>
        <CardTitle>Trustline creation &amp; removal velocity</CardTitle>
        <p className="text-xs text-text-muted">
          UTC buckets for period <span className="font-mono">{series.period}</span>{" "}
          · Net change:{" "}
          <span
            data-testid="trustline-net-change"
            className="font-mono text-text-primary"
          >
            {netPrefix}
            {series.netTrustlineChange.toLocaleString("en-US")}
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-xs">
            <caption className="sr-only">
              Trustline creation and removal operations by UTC bucket
            </caption>
            <thead className="uppercase text-text-muted">
              <tr>
                <th className="px-2 py-1.5">Bucket (UTC)</th>
                <th className="px-2 py-1.5 text-right">Created</th>
                <th className="px-2 py-1.5 text-right">Removed</th>
                <th className="px-2 py-1.5 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {series.buckets.map((bucket) => (
                <tr
                  key={bucket.timestampUtc}
                  className="border-t border-border/60 font-mono"
                >
                  <td className="px-2 py-1.5">{bucket.label}</td>
                  <td className="px-2 py-1.5 text-right">
                    {bucket.createdCount.toLocaleString("en-US")}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {bucket.removedCount.toLocaleString("en-US")}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {bucket.netChange > 0 ? `+${bucket.netChange}` : bucket.netChange}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted">
          Classifies <code>change_trust</code> operations with positive limit as
          creations/updates and zero limit as removals.{" "}
          <a
            href={series.methodologyHref}
            className="underline hover:text-text-primary"
          >
            Methodology
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
