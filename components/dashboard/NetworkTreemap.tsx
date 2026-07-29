"use client";

<<<<<<< Updated upstream
import { CATEGORY_COLORS } from "@/lib/constants";
=======
import { useMemo, useState } from "react";
import { CATEGORY_COLORS, TREEMAP_VIEWS } from "@/lib/constants";
import { PERIOD_OPTIONS } from "@/lib/periods";
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
  const activeTreemap = data.treemaps[treemapView];
=======
  const isZeroActivity =
    !activeTreemap?.children || activeTreemap.children.length === 0;

  const isFilteredEmpty =
    !isZeroActivity && (!filteredTreemap.children || filteredTreemap.children.length === 0);

  const activeViewLabel =
    TREEMAP_VIEWS.find((v) => v.id === treemapView)?.label?.toLowerCase() ||
    "activity";
  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === period)?.label?.toLowerCase() ||
    "this period";
>>>>>>> Stashed changes

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
      <CardContent>
        <div
          key={`${period}-${treemapView}`}
          className="h-[420px] sm:h-[520px] lg:h-[600px] overflow-hidden rounded-xl border border-white/5 bg-black/20 p-2 sm:p-3"
        >
<<<<<<< Updated upstream
          <D3Treemap root={activeTreemap} onSelect={setSelectedNode} />
=======
          {isZeroActivity ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-2 text-zinc-400">
              <svg
                className="h-10 w-10 text-zinc-600 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-sm font-medium text-zinc-300">
                No data available
              </p>
              <p className="text-xs">
                There are no {activeViewLabel} for {periodLabel}.
              </p>
            </div>
          ) : isFilteredEmpty ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              No categories selected.
            </div>
          ) : (
            <D3Treemap root={filteredTreemap} onSelect={setSelectedNode} />
          )}
>>>>>>> Stashed changes
        </div>
      </CardContent>
    </Card>
  );
}
