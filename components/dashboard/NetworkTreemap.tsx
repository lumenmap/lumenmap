"use client";

import { CATEGORY_COLORS } from "@/lib/constants";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { D3Treemap } from "@/components/dashboard/D3Treemap";
import { TreemapViewSelector } from "@/components/dashboard/TreemapViewSelector";
import { TreemapMetricSelector } from "@/components/dashboard/TreemapMetricSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TreemapNode } from "@/lib/types";

const CATEGORY_LEGEND = [
  { key: "soroban", label: "Soroban" },
  { key: "payments", label: "Payments" },
  { key: "dex", label: "DEX" },
  { key: "trustlines", label: "Trustlines" },
  { key: "account", label: "Account Ops" },
  { key: "other", label: "Other" },
];

function toChartNode(node: TreemapNode<number | string>): TreemapNode {
  const { value, children, ...rest } = node;
  return {
    ...rest,
    ...(value !== undefined ? { value: Number(value) } : {}),
    ...(children
      ? { children: children.map(toChartNode) }
      : {}),
  };
}

export function NetworkTreemap() {
  const {
    data,
    isLoading,
    isError,
    error,
    period,
    treemapView,
    metric,
    setSelectedNode,
  } = useDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Treemap</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[520px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Treemap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[360px] items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-200">
            {error?.message ?? "Unable to load treemap data."}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activePayload = metric === "xlm_volume"
    ? data.treemaps[`xlm_${treemapView}` as keyof typeof data.treemaps]
    : data.treemaps[treemapView];
  const activeTreemap = toChartNode(activePayload);

  if (!activeTreemap) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Treemap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[360px] items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center text-sm text-yellow-200">
            Protocol TVL data is not available for this view.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4">
        <div>
          <CardTitle>Network Treemap</CardTitle>
          <p className="text-xs text-zinc-500">
            Switch views to explore operation types or top accounts and
            contracts.
          </p>
        </div>
        <TreemapViewSelector />
        <TreemapMetricSelector />
        <div className="flex flex-wrap gap-2">
          {CATEGORY_LEGEND.map((item) => (
            <span
              key={item.key}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[item.key] }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div
          key={`${period}-${treemapView}-${metric}`}
          className="h-[420px] sm:h-[520px] lg:h-[600px] overflow-hidden rounded-xl border border-white/5 bg-black/20 p-2 sm:p-3"
        >
          {activeTreemap.children && activeTreemap.children.length > 0 ? (
            <D3Treemap root={activeTreemap} onSelect={setSelectedNode} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              No data for this metric and view combination.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
