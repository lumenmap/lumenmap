"use client";

import { Activity, Boxes, Layers, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
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

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {KPI_CONFIG.map((item) => (
          <Card key={item.key}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {KPI_CONFIG.map((item) => {
        const Icon = item.icon;
        const value = data.kpis[item.key];

        return (
          <Card key={item.key}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{item.title}</CardTitle>
              <Icon className="h-4 w-4 text-stellar-light" />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-white sm:text-xl lg:text-2xl">
                {item.format(value as never)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
