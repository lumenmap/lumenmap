"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, HelpCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { formatNumber } from "@/lib/utils";

export function TimeSeriesChart() {
  const { data, isLoading, isError, error } = useDashboard();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const timeseries = data?.timeseries;
  const buckets = useMemo(() => timeseries?.buckets ?? [], [timeseries]);

  // Calculate scales and geometry for responsive SVG
  const width = 800;
  const height = 260;
  const padding = { top: 25, right: 30, bottom: 40, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = useMemo(() => {
    if (buckets.length === 0) return 100;
    let max = 0;
    for (const b of buckets) {
      if (b.operations > max) max = b.operations;
      if (b.transactions > max) max = b.transactions;
    }
    return max === 0 ? 100 : Math.ceil(max * 1.15);
  }, [buckets]);

  // Points computation
  const points = useMemo(() => {
    if (buckets.length === 0) return [];
    const step = buckets.length > 1 ? chartWidth / (buckets.length - 1) : chartWidth;

    return buckets.map((b, i) => {
      const x = padding.left + (buckets.length === 1 ? chartWidth / 2 : i * step);
      const yOps = padding.top + chartHeight - (b.operations / maxVal) * chartHeight;
      const yTx = padding.top + chartHeight - (b.transactions / maxVal) * chartHeight;

      return {
        x,
        yOps,
        yTx,
        bucket: b,
        index: i,
      };
    });
  }, [buckets, chartWidth, chartHeight, maxVal, padding.left, padding.top]);

  // SVG Paths
  const opsPath = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yOps}` : `${acc} L ${p.x} ${p.yOps}`),
      "",
    );
  }, [points]);

  const txPath = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yTx}` : `${acc} L ${p.x} ${p.yTx}`),
      "",
    );
  }, [points]);

  // Area fill for operations trend
  const opsAreaPath = useMemo(() => {
    if (points.length === 0) return "";
    const first = points[0];
    const last = points[points.length - 1];
    const bottom = padding.top + chartHeight;
    return `${opsPath} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
  }, [opsPath, points, padding.top, chartHeight]);

  // Y-axis grid ticks
  const yTicks = useMemo(() => {
    const count = 4;
    const ticks = [];
    for (let i = 0; i <= count; i++) {
      const val = Math.round((maxVal / count) * i);
      const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
      ticks.push({ val, y });
    }
    return ticks;
  }, [maxVal, chartHeight, padding.top]);

  // X-axis label selection (show subsets if too many points)
  const xLabels = useMemo(() => {
    if (points.length === 0) return [];
    const maxLabels = 8;
    const interval = Math.ceil(points.length / maxLabels);
    return points.filter((_, i) => i % interval === 0 || i === points.length - 1);
  }, [points]);

  // Handle explicit states
  if (isLoading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="pt-4">
          <Skeleton className="h-[260px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-red-950/40 bg-zinc-900/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium text-red-400">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Time-Series Data Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <p className="text-sm text-zinc-400">
            {error instanceof Error
              ? error.message
              : "Unable to load time-series activity charts from Hubble BigQuery."}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Verify GOOGLE_APPLICATION_CREDENTIALS or BigQuery dataset access permissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
  const activeBucket = activePoint?.bucket;

  const hasData = buckets.some((b) => b.operations > 0 || b.transactions > 0);

  return (
    <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
            Network Activity Time Series
          </CardTitle>
          <p className="text-xs text-zinc-400">
            Bucket trend comparison of operations vs transactions ({timeseries?.granularity === "hour" ? "hourly" : "daily"} UTC buckets)
          </p>
        </div>

        {/* Accessible Legend - Visual distinction without color alone */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2" title="Operations (Solid Line + Circle Marker)">
            <svg className="h-3.5 w-6">
              <line x1="0" y1="7" x2="24" y2="7" stroke="#22d3ee" strokeWidth="2" />
              <circle cx="12" cy="7" r="3" fill="#22d3ee" />
            </svg>
            <span className="font-medium text-zinc-300">Operations</span>
          </div>

          <div className="flex items-center gap-2" title="Transactions (Dashed Line + Square Marker)">
            <svg className="h-3.5 w-6">
              <line
                x1="0"
                y1="7"
                x2="24"
                y2="7"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              <rect x="9.5" y="4.5" width="5" height="5" fill="#fbbf24" />
            </svg>
            <span className="font-medium text-zinc-300">Transactions</span>
          </div>

          {buckets.some((b) => b.isPartial) && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="inline-block h-2.5 w-2.5 rounded-xs border border-dashed border-cyan-400/60 bg-cyan-950/40" />
              <span className="text-[11px] font-medium text-zinc-400">Partial bucket</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {!hasData ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 text-center">
            <HelpCircle className="h-8 w-8 text-zinc-500" />
            <p className="text-sm text-zinc-400">No activity recorded for this period.</p>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible select-none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                {/* Operations area gradient */}
                <linearGradient id="opsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                </linearGradient>

                {/* Partial bucket hatching pattern */}
                <pattern
                  id="partialHatch"
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(34, 211, 238, 0.15)" strokeWidth="3" />
                </pattern>
              </defs>

              {/* Grid lines */}
              {yTicks.map((t, idx) => (
                <g key={idx}>
                  <line
                    x1={padding.left}
                    y1={t.y}
                    x2={width - padding.right}
                    y2={t.y}
                    stroke="#27272a"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={padding.left - 8}
                    y={t.y + 4}
                    fill="#71717a"
                    fontSize="10"
                    textAnchor="end"
                    className="font-mono"
                  >
                    {formatNumber(t.val)}
                  </text>
                </g>
              ))}

              {/* Partial Bucket Background Region */}
              {points.map((p) => {
                if (!p.bucket.isPartial) return null;
                const halfStep =
                  points.length > 1 ? chartWidth / (points.length - 1) / 2 : chartWidth / 2;
                const rectX = Math.max(padding.left, p.x - halfStep);
                const rectW = Math.min(width - padding.right - rectX, halfStep * 2);

                return (
                  <g key={`partial-bg-${p.index}`}>
                    <rect
                      x={rectX}
                      y={padding.top}
                      width={rectW}
                      height={chartHeight}
                      fill="url(#partialHatch)"
                      rx="3"
                    />
                    <rect
                      x={rectX}
                      y={padding.top}
                      width={rectW}
                      height={chartHeight}
                      fill="none"
                      stroke="#0891b2"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                      opacity="0.4"
                      rx="3"
                    />
                  </g>
                );
              })}

              {/* Area path for operations */}
              <path d={opsAreaPath} fill="url(#opsGradient)" />

              {/* Operations line (Solid) */}
              <path
                d={opsPath}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Transactions line (Dashed) */}
              <path
                d={txPath}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points & shape markers */}
              {points.map((p) => {
                const isHovered = hoverIndex === p.index;

                return (
                  <g key={p.index}>
                    {/* Operations node marker: Circle */}
                    <circle
                      cx={p.x}
                      cy={p.yOps}
                      r={isHovered ? "5" : "3"}
                      fill="#22d3ee"
                      stroke="#09090b"
                      strokeWidth="1.5"
                      className="transition-all duration-150"
                    />

                    {/* Transactions node marker: Square */}
                    <rect
                      x={p.x - (isHovered ? 4.5 : 3)}
                      y={p.yTx - (isHovered ? 4.5 : 3)}
                      width={isHovered ? 9 : 6}
                      height={isHovered ? 9 : 6}
                      fill="#fbbf24"
                      stroke="#09090b"
                      strokeWidth="1.5"
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}

              {/* X-axis ticks & labels */}
              {xLabels.map((p, idx) => (
                <g key={idx}>
                  <line
                    x1={p.x}
                    y1={padding.top + chartHeight}
                    x2={p.x}
                    y2={padding.top + chartHeight + 4}
                    stroke="#52525b"
                  />
                  <text
                    x={p.x}
                    y={padding.top + chartHeight + 18}
                    fill="#a1a1aa"
                    fontSize="11"
                    textAnchor="middle"
                    className="font-medium"
                  >
                    {p.bucket.label}
                  </text>
                </g>
              ))}

              {/* Hover tracking vertical line */}
              {activePoint && (
                <g>
                  <line
                    x1={activePoint.x}
                    y1={padding.top}
                    x2={activePoint.x}
                    y2={padding.top + chartHeight}
                    stroke="#a1a1aa"
                    strokeDasharray="3 3"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Interactive invisible hover targets */}
              {points.map((p) => {
                const step =
                  points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;
                const rectX = p.x - step / 2;

                return (
                  <rect
                    key={`hover-target-${p.index}`}
                    x={Math.max(padding.left, rectX)}
                    y={padding.top}
                    width={step}
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(p.index)}
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {activePoint && activeBucket && (
              <div
                className="pointer-events-none absolute z-20 flex flex-col gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950/90 px-3.5 py-2.5 text-xs text-white shadow-xl backdrop-blur-md transition-all duration-75"
                style={{
                  left: `${Math.min(Math.max(activePoint.x - 70, 10), width - 170)}px`,
                  top: `${Math.max(activePoint.yOps - 90, 10)}px`,
                }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-1.5">
                  <span className="font-semibold text-zinc-200">{activeBucket.label}</span>
                  {activeBucket.isPartial && (
                    <span className="rounded-full bg-cyan-950 px-2 py-0.5 text-[10px] font-medium text-cyan-300 border border-cyan-800/50">
                      Partial bucket
                    </span>
                  )}
                </div>

                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
                      Operations:
                    </span>
                    <span className="font-mono font-semibold text-white">
                      {formatNumber(activeBucket.operations)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="inline-block h-2 w-2 rounded-xs bg-amber-400" />
                      Transactions:
                    </span>
                    <span className="font-mono font-semibold text-white">
                      {formatNumber(activeBucket.transactions)}
                    </span>
                  </div>

                  {activeBucket.transactions > 0 && (
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                      <span>Ops / Tx Ratio:</span>
                      <span className="font-mono font-medium text-zinc-300">
                        {(activeBucket.operations / activeBucket.transactions).toFixed(2)}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
