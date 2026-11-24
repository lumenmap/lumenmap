"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import type { FeePoint, FeePressure } from "@/lib/network-fee-pressure";
import type { TimeseriesBucket } from "@/lib/types";

function Sparkline({ points, buckets, color, label, unit }: {
  points: FeePoint[];
  buckets: TimeseriesBucket[];
  color: string;
  label: string;
  unit: string;
}) {
  const values = new Map(points.map((point) => [point.timestamp, point.stroops]));
  const times = buckets.length ? buckets.map((bucket) => bucket.timestamp) : points.map((point) => point.timestamp);
  const max = Math.max(1, ...points.map((point) => point.stroops));
  const x = (index: number) => times.length === 1 ? 150 : 10 + index * 280 / (times.length - 1);
  const y = (value: number) => 53 - value / max * 43;
  let path = "";
  times.forEach((timestamp, index) => {
    const value = values.get(timestamp);
    if (value === undefined) return;
    path += `${path && values.has(times[index - 1]) ? " L" : " M"}${x(index)} ${y(value)}`;
  });
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs text-zinc-300">{label} <span className="text-zinc-500">({unit})</span></p>
      <svg viewBox="0 0 300 60" className="h-16 w-full" role="img" aria-label={`${label} trend in ${unit}`}>
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {times.map((timestamp, index) => {
          const value = values.get(timestamp);
          return value === undefined ? null : (
            <circle key={timestamp} cx={x(index)} cy={y(value)} r="2.5" fill={color}>
              <title>{`${timestamp}: ${Math.round(value).toLocaleString("en-US")} ${unit}`}</title>
            </circle>
          );
        })}
      </svg>
      <p className="text-right font-mono text-xs text-zinc-400">
        Latest: {Math.round(points.at(-1)?.stroops ?? 0).toLocaleString("en-US")} {unit}
      </p>
    </div>
  );
}

export function NetworkFeePressurePanelView({ result, buckets }: {
  result: FeePressure;
  buckets: TimeseriesBucket[];
}) {
  if (!result.classic?.length && !result.soroban?.length) return null;
  const opPoints = buckets.map((bucket) => ({ timestamp: bucket.timestamp, stroops: bucket.operations }));
  return (
    <Card data-testid="network-fee-pressure">
      <CardHeader>
        <CardTitle>Network fee pressure</CardTitle>
        <p className="text-xs text-zinc-400">
          {result.source === "fixture" ? "Fixture sample · " : ""}
          {result.granularity === "hour" ? "Hourly" : "Daily"} UTC buckets · selected period
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.classic && result.classic.length > 0 && (
          <Sparkline points={result.classic} buckets={buckets} color="#22d3ee" label="Classic p95 charged fee per operation" unit="stroops/op" />
        )}
        {result.soroban && result.soroban.length > 0 && (
          <Sparkline points={result.soroban} buckets={buckets} color="#fbbf24" label="Soroban average non-refundable resource fee per contract transaction" unit="stroops/transaction" />
        )}
        {buckets.length > 0 && (
          <Sparkline points={opPoints} buckets={buckets} color="#a1a1aa" label="Operations on the same period" unit="operations" />
        )}
        <p className="text-xs leading-relaxed text-zinc-500">
          Classic p95 is calculated from charged transaction fees divided by operation count; Soroban is the average non-refundable resource fee from contract-attributed transactions. Scales are independent, so compare timing rather than height. Missing buckets have no observed fee rows. {result.classic === null || result.soroban === null ? "An unavailable fee series is omitted. " : ""}
          <a href="/methodology#network-fee-pressure" className="text-stellar-light hover:text-white underline">Methodology</a>
        </p>
      </CardContent>
    </Card>
  );
}

export function NetworkFeePressurePanel() {
  const { period, network, data } = useDashboard();
  const query = useQuery<FeePressure>({
    queryKey: ["network-fee-pressure", period, network],
    queryFn: async () => {
      const response = await fetch(`/api/network-fee-pressure?period=${period}&network=${network}`);
      if (!response.ok) throw new Error("Fee pressure unavailable");
      return response.json();
    },
    retry: false,
  });
  if (!query.data || query.isError) return null;
  return <NetworkFeePressurePanelView result={query.data} buckets={data?.timeseries?.buckets ?? []} />;
}
