"use client";

import { CATEGORY_COLORS } from "@/lib/constants";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { D3Treemap } from "@/components/dashboard/D3Treemap";
import { TreemapViewSelector } from "@/components/dashboard/TreemapViewSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_LEGEND = [
  { key: "soroban", label: "Soroban" },
  { key: "payments", label: "Payments" },
  { key: "dex", label: "DEX" },
  { key: "trustlines", label: "Trustlines" },
  { key: "account", label: "Account Ops" },
  { key: "other", label: "Other" },
];

export function NetworkTreemap() {
  const {
    data,
    isLoading,
    isError,
    error,
    period,
    treemapView,
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

  const activeTreemap = data.treemaps[treemapView];

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
      <CardContent className="min-w-0">
        <div
          key={`${period}-${treemapView}`}
          className="h-[420px] sm:h-[520px] lg:h-[600px] max-w-full overflow-hidden rounded-xl border border-white/5 bg-black/20 p-2 sm:p-3"
        >
          <D3Treemap root={activeTreemap} onSelect={setSelectedNode} />
        </div>
      </CardContent>
    </Card>
  );
}
