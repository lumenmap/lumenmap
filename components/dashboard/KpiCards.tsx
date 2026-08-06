"use client";

import { Activity, Boxes, Layers, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { classifyFreshness } from "@/lib/freshness";
import { formatNumber, formatPercent } from "@/lib/utils";

const KPI_CONFIG = [
  {
    key: "totalOps",
    title: "Total Operations",
    icon: Activity,
    format: (value: number) => formatNumber(value),
  },
  {
    key: "sorobanShare",
    title: "Soroban Share",
    icon: Zap,
    format: (value: number) => formatPercent(value),
  },
  {
    key: "topCategory",
    title: "Top Category",
    icon: Layers,
    format: (value: string) => value,
  },
  {
    key: "activeContracts",
    title: "Active Contracts",
    icon: Boxes,
    format: (value: number) => formatNumber(value),
  },
] as const;

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
        const kpi = data.kpis[item.key];
        const value = typeof kpi === "string" ? kpi : kpi.value;

        return (
          <Card key={item.key}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{item.title}</CardTitle>
              <Icon className="h-4 w-4 text-surface-accent" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-text-primary">
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
