"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import {
  CATEGORY_IDS,
  toPercentageCategories,
  type CategoryId,
  type CategoryShareMode,
} from "@/lib/charts/category-share";
import type { CategoryShareResponse } from "@/lib/hubble/category-share";
import { formatNumber, formatPercent } from "@/lib/utils";
import { getErrorCopy } from "@/lib/error-copy";

async function fetchCategoryShare(
  period: string,
): Promise<CategoryShareResponse> {
  const response = await fetch(`/api/category-share?period=${period}`);
  if (!response.ok) {
    const body = (await response.json()) as { code?: string; error?: string };
    const error = new Error(body.error ?? "Failed to load category share chart");
    if (body.code) {
      Object.assign(error, { code: body.code });
    }
    throw error;
  }
  return response.json() as Promise<CategoryShareResponse>;
}

function formatBucketLabel(
  iso: string,
  granularity: CategoryShareResponse["granularity"],
): string {
  const date = new Date(iso);
  if (granularity === "hour") {
    return `${String(date.getUTCHours()).padStart(2, "0")}:00`;
  }
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number;
  color?: string;
  name?: string;
  payload?: Record<string, unknown>;
}

function CategoryShareTooltip({
  active,
  payload,
  mode,
  legendById,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  mode: CategoryShareMode;
  legendById: Map<CategoryId, { label: string; color: string }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload ?? {};
  const label = String(point.label ?? "");
  const total = Number(point.total ?? 0);
  const partial = Boolean(point.partial);

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-zinc-100">
        {label} UTC{partial ? " · partial" : ""}
      </p>
      <p className="mt-1 text-zinc-400">
        Total: {mode === "absolute" ? formatNumber(total) : "100%"}
        {mode === "percentage" && total > 0
          ? ` · ${formatNumber(total)} ops`
          : ""}
      </p>
      <ul className="mt-2 space-y-1">
        {[...CATEGORY_IDS].reverse().map((id) => {
          const value = Number(point[id] ?? 0);
          if (mode === "absolute" && value <= 0 && total > 0) {
            return null;
          }
          if (total <= 0 && value <= 0) {
            return null;
          }
          const meta = legendById.get(id);
          return (
            <li key={id} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-zinc-300">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta?.color }}
                />
                {meta?.label ?? id}
              </span>
              <span className="font-mono text-zinc-100">
                {mode === "absolute"
                  ? formatNumber(value)
                  : formatPercent(value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CategoryShareChart() {
  const { period, isError: activityError } = useDashboard();
  const [mode, setMode] = useState<CategoryShareMode>("percentage");

  const query = useQuery({
    queryKey: ["category-share", period],
    queryFn: () => fetchCategoryShare(period),
    staleTime: 60_000,
  });

  const errorCode = (query.error as Error & { code?: string })?.code;
  const errorCopy = errorCode ? getErrorCopy(errorCode as Parameters<typeof getErrorCopy>[0]) : null;

  const legendById = useMemo(() => {
    const map = new Map<CategoryId, { label: string; color: string }>();
    for (const item of query.data?.legend ?? []) {
      map.set(item.id, { label: item.label, color: item.color });
    }
    return map;
  }, [query.data?.legend]);

  const chartData = useMemo(() => {
    if (!query.data) {
      return [];
    }

    return query.data.buckets.map((bucket) => {
      const values =
        mode === "percentage"
          ? toPercentageCategories(bucket.categories, bucket.total)
          : bucket.categories;

      return {
        key: bucket.bucketStart,
        label: formatBucketLabel(bucket.bucketStart, query.data.granularity),
        total: bucket.total,
        partial: bucket.partial,
        ...values,
      };
    });
  }, [mode, query.data]);

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category share over time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError || !query.data) {
    const message = errorCopy?.message ?? query.error?.message ?? "Unable to load category share chart.";
    const hint = errorCopy?.hint;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Category share over time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-200">
            <p>{message}</p>
            {hint && <p className="text-xs text-zinc-400">{hint}</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Category share over time</CardTitle>
          <p className="text-xs text-zinc-500">
            UTC {query.data.granularity === "hour" ? "hourly" : "daily"} buckets
            {query.data.source === "fixture" ? " · sample fixture data" : ""}
            {" · "}
            partial buckets marked on the axis
          </p>
          {activityError ? (
            <p
              data-testid="category-share-independent"
              className="text-xs text-amber-300"
            >
              Network activity failed to load, but this chart uses a separate
              request and is still live.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={mode === "percentage" ? "default" : "outline"}
            onClick={() => setMode("percentage")}
          >
            Share %
          </Button>
          <Button
            size="sm"
            variant={mode === "absolute" ? "default" : "outline"}
            onClick={() => setMode("absolute")}
          >
            Absolute
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {query.data.legend.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>

        <div className="h-[280px] w-full sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                interval="preserveStartEnd"
                tickFormatter={(value: string, index: number) => {
                  const point = chartData[index];
                  return point?.partial ? `${value}*` : value;
                }}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={mode === "percentage" ? [0, 100] : [0, "auto"]}
                tickFormatter={(value: number) =>
                  mode === "percentage"
                    ? `${Math.round(value)}%`
                    : formatNumber(value)
                }
              />
              <Tooltip
                content={
                  <CategoryShareTooltip mode={mode} legendById={legendById} />
                }
              />
              {CATEGORY_IDS.map((id) => {
                const meta = legendById.get(id);
                return (
                  <Area
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stackId="categories"
                    stroke={meta?.color}
                    fill={meta?.color}
                    fillOpacity={0.75}
                    strokeWidth={1}
                    isAnimationActive={false}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-zinc-500">
          * Partial bucket (UTC interval still in progress). Tooltip values are
          exact counts or shares for the hovered bucket.
        </p>
      </CardContent>
    </Card>
  );
}
