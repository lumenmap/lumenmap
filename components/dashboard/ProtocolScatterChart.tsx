"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import type { ProtocolHealthResponseBody } from "@/lib/schemas/protocol-health";
import { formatNumber } from "@/lib/utils";

const WIDTH = 720;
const HEIGHT = 360;
const LEFT = 72;
const RIGHT = 24;
const TOP = 20;
const BOTTOM = 54;
const COLORS = [
  "#7B61FF",
  "#14B8A6",
  "#F59E0B",
  "#3B82F6",
  "#EC4899",
  "#06B6D4",
];

type ProtocolPoint = ProtocolHealthResponseBody["protocols"][number];

async function fetchProtocolHealth(
  period: string,
  network: string,
): Promise<ProtocolHealthResponseBody> {
  const params = new URLSearchParams({ period });
  if (network !== "mainnet") params.set("network", network);
  const response = await fetch(`/api/v1/protocols/health?${params}`);
  if (!response.ok) {
    throw new Error("Failed to load protocol activity data");
  }
  return response.json() as Promise<ProtocolHealthResponseBody>;
}

export function ProtocolScatterChart() {
  const { period, network } = useDashboard();
  const query = useQuery({
    queryKey: ["protocol-health", period, network],
    queryFn: () => fetchProtocolHealth(period, network),
    staleTime: 60_000,
  });

  if (query.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Protocol activity reach</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="text-sm text-red-200">
            {query.error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (query.isLoading || !query.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Protocol activity reach</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[360px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  const protocols = query.data.protocols.slice(0, query.data.displayLimit);
  const points = protocols.filter(
    (protocol) =>
      protocol.components.ops.status === "available" &&
      protocol.components.ops.value != null &&
      protocol.components.wallets.status === "available" &&
      protocol.components.wallets.value != null,
  );
  const omittedCount = protocols.length - points.length;
  const volumeComplete =
    points.length > 0 &&
    points.every(
      (protocol) =>
        protocol.components.volume.status === "available" &&
        protocol.components.volume.value != null,
    );
  const maxOps =
    Math.max(
      1,
      ...points.map((point) => point.components.ops.value ?? 0),
    ) * 1.15;
  const walletMax =
    Math.max(
      1,
      ...points.map((point) => point.components.wallets.value ?? 0),
    ) * 1.2;
  const maxVolume = Math.max(
    0,
    ...points.map((point) => point.components.volume.value ?? 0),
  );
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const x = (value: number) => LEFT + (value / maxOps) * plotWidth;
  const y = (value: number) =>
    TOP + plotHeight - (value / walletMax) * plotHeight;
  const radius = (point: ProtocolPoint) => {
    if (!volumeComplete || maxVolume === 0) return 10;
    const volume = point.components.volume.value ?? 0;
    return 7 + Math.sqrt(volume / maxVolume) * 17;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocol activity reach</CardTitle>
        <p className="text-xs text-zinc-500">
          Operations vs. distinct labeled wallets and contracts · select a point
          to open protocol details
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {points.length > 0 ? (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="group"
            aria-label="Protocol activity scatter plot"
            className="h-auto w-full overflow-visible"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
              const horizontal = TOP + plotHeight * (1 - fraction);
              const vertical = LEFT + plotWidth * fraction;
              return (
                <g key={fraction}>
                  <line
                    x1={LEFT}
                    x2={WIDTH - RIGHT}
                    y1={horizontal}
                    y2={horizontal}
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <text
                    x={LEFT - 10}
                    y={horizontal + 4}
                    textAnchor="end"
                    className="fill-zinc-500 text-[11px]"
                  >
                    {formatNumber(Math.round(walletMax * fraction))}
                  </text>
                  <line
                    x1={vertical}
                    x2={vertical}
                    y1={TOP}
                    y2={TOP + plotHeight}
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <text
                    x={vertical}
                    y={HEIGHT - BOTTOM + 20}
                    textAnchor="middle"
                    className="fill-zinc-500 text-[11px]"
                  >
                    {formatNumber(Math.round(maxOps * fraction))}
                  </text>
                </g>
              );
            })}
            <line
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={TOP + plotHeight}
              y2={TOP + plotHeight}
              stroke="rgba(255,255,255,0.25)"
            />
            <line
              x1={LEFT}
              x2={LEFT}
              y1={TOP}
              y2={TOP + plotHeight}
              stroke="rgba(255,255,255,0.25)"
            />
            <text
              x={LEFT + plotWidth / 2}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-zinc-400 text-xs"
            >
              Operations
            </text>
            <text
              x={16}
              y={TOP + plotHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 16 ${TOP + plotHeight / 2})`}
              className="fill-zinc-400 text-xs"
            >
              Unique wallets
            </text>
            {points.map((point, index) => {
              const ops = point.components.ops.value ?? 0;
              const wallets = point.components.wallets.value ?? 0;
              const volume = point.components.volume.value;
              const accessibleName = [
                point.protocol,
                `${formatNumber(ops)} operations`,
                `${formatNumber(wallets)} unique wallets`,
                volume == null
                  ? "volume unavailable"
                  : `${formatNumber(volume)} XLM volume`,
                "Open protocol details",
              ].join(", ");
              return (
                <a
                  key={point.protocol}
                  href={point.detail.href}
                  aria-label={accessibleName}
                  className="group"
                >
                  <title>{accessibleName}</title>
                  <circle
                    cx={x(ops)}
                    cy={y(wallets)}
                    r={radius(point)}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity="0.8"
                    stroke="transparent"
                    strokeWidth="3"
                    className="transition-colors group-hover:stroke-white group-focus-visible:stroke-white"
                  />
                  <text
                    x={x(ops)}
                    y={y(wallets) - radius(point) - 7}
                    textAnchor="middle"
                    className="pointer-events-none fill-zinc-200 text-[11px]"
                  >
                    {point.protocol}
                  </text>
                </a>
              );
            })}
          </svg>
        ) : (
          <p className="py-12 text-center text-sm text-zinc-400">
            No protocols have both operations and wallet measurements for this
            period.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
          {volumeComplete ? (
            <span>Bubble area represents XLM volume</span>
          ) : (
            <span>
              Equal-size bubbles: XLM volume is unavailable or incomplete
            </span>
          )}
          {omittedCount > 0 ? (
            <span>
              {omittedCount}{" "}
              {omittedCount === 1 ? "protocol omitted" : "protocols omitted"}:
              {" "}
              operations or wallets unavailable
            </span>
          ) : null}
          <a
            href="/methodology#protocol-scatter"
            className="text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
          >
            Axis methodology
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
