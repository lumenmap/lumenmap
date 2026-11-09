"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeePressureAnalytics } from "@/lib/soroban-fees/pressure";

function formatStroops(value: number | null): string {
  if (value === null) return "Unavailable";
  return `${value.toLocaleString("en-US")} stroops`;
}

export function NetworkFeePressurePanel({
  analytics,
}: {
  analytics: FeePressureAnalytics;
}) {
  if (
    analytics.status === "unavailable" ||
    (!analytics.classicAvailable && !analytics.sorobanAvailable)
  ) {
    return null;
  }

  return (
    <Card data-testid="network-fee-pressure-panel">
      <CardHeader>
        <CardTitle>Network fee pressure (classic &amp; Soroban)</CardTitle>
        <p className="text-xs text-text-muted">
          {analytics.source === "fixture" ? "Fixture sample · " : ""}
          Units in <span className="font-mono">stroops</span> alongside
          same-period operation counts.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            data-testid="fee-pressure-classic-peak"
            className="rounded-lg border border-border bg-background/60 p-3"
          >
            <p className="text-xs text-text-muted">
              Peak classic median fee (stroops)
            </p>
            <p className="mt-1 font-mono text-base text-text-primary">
              {formatStroops(analytics.peakClassicMedianStroops)}
            </p>
          </div>
          <div
            data-testid="fee-pressure-soroban-peak"
            className="rounded-lg border border-border bg-background/60 p-3"
          >
            <p className="text-xs text-text-muted">
              Peak Soroban resource fee (stroops)
            </p>
            <p className="mt-1 font-mono text-base text-text-primary">
              {formatStroops(analytics.peakSorobanResourceStroops)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Classic and Soroban fee pressure by time bucket in stroops
            </caption>
            <thead className="uppercase text-text-muted">
              <tr>
                <th className="px-2 py-1.5">Bucket (UTC)</th>
                <th className="px-2 py-1.5 text-right">
                  Classic median (stroops)
                </th>
                <th className="px-2 py-1.5 text-right">
                  Soroban resources (stroops)
                </th>
                <th className="px-2 py-1.5 text-right">Operations</th>
              </tr>
            </thead>
            <tbody>
              {analytics.buckets.map((bucket) => (
                <tr
                  key={bucket.timestamp}
                  className="border-t border-border/60 font-mono"
                >
                  <td className="px-2 py-1.5">{bucket.label}</td>
                  <td className="px-2 py-1.5 text-right">
                    {formatStroops(bucket.classicMedianFeeStroops)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {formatStroops(bucket.sorobanResourceFeeStroops)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {bucket.operations.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-text-muted">
          {analytics.note}{" "}
          <a
            href={analytics.methodologyHref}
            className="underline hover:text-text-primary"
          >
            Methodology
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
