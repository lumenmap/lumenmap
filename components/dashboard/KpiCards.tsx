"use client";

import { Activity, Boxes, Layers, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricInfo } from "@/components/metrics/MetricInfo";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { classifyFreshness } from "@/lib/freshness";
import {
  METRIC_DEFINITIONS,
  type KpiMetricId,
} from "@/lib/metrics/definitions";
import { formatNumber, formatPercent } from "@/lib/utils";

const KPI_CONFIG = [
  {
    key: "totalOps" as const satisfies KpiMetricId,
    icon: Activity,
    format: (value: number) => formatNumber(value),
  },
  {
    key: "sorobanShare" as const satisfies KpiMetricId,
    icon: Zap,
    format: (value: number) => formatPercent(value),
  },
  {
    key: "topCategory" as const satisfies KpiMetricId,
    icon: Layers,
    format: (value: string) => value,
  },
  {
    key: "activeContracts" as const satisfies KpiMetricId,
    icon: Boxes,
    format: (value: number) => formatNumber(value),
  },
];

export function KpiCards() {
  const { data, isLoading } = useDashboard();
  const freshnessState = classifyFreshness(data?.sourceTimestamp);

  if (isLoading || !data) {
    return (
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4"
        aria-busy="true"
      >
        {KPI_CONFIG.map((item) => (
          <Card key={item.key}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              {/* Titles wrap to two lines in the narrow mobile columns, so the
                  skeleton reserves the same number of lines per breakpoint. */}
              <div className="min-w-0 flex-1 space-y-1">
                <Skeleton className="h-4 w-24 max-w-full" />
                <Skeleton className="h-4 w-16 max-w-full sm:hidden" />
              </div>
              <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 max-w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {KPI_CONFIG.map((item) => {
        const Icon = item.icon;
        const metric = METRIC_DEFINITIONS[item.key];
        const kpi = data.kpis[item.key];
        const value = typeof kpi === "string" ? kpi : kpi.value;

        return (
          <Card key={item.key}>
            <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <CardTitle>{metric.title}</CardTitle>
                <MetricInfo metric={metric} />
              </div>
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-stellar-light" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">
                {item.format(value as never)}
              </p>
              {freshnessState === "stale" ? (
                <p className="mt-0.5 text-xs font-medium text-amber-400">
                  (stale)
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
