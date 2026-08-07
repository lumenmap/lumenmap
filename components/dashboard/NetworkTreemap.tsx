"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CATEGORY_COLORS, TREEMAP_VIEWS } from "@/lib/constants";
import { PERIOD_OPTIONS } from "@/lib/periods";
import { PATTERN_DEFS, PATTERN_OPACITY, getCategoryPatternId } from "@/lib/treemap-patterns";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { D3Treemap } from "@/components/dashboard/D3Treemap";
import { ExportControls } from "@/components/dashboard/ExportControls";
import { TreemapDataTable } from "@/components/dashboard/TreemapDataTable";
import { resolveActiveLevel } from "@/lib/entities/treemap-level";
import { TreemapViewSelector } from "@/components/dashboard/TreemapViewSelector";
import { TreemapMetricSelector } from "@/components/dashboard/TreemapMetricSelector";
import { Button } from "@/components/ui/button";
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

// Shared with the loading skeleton so reserved space matches the rendered
// chart at every breakpoint.
const CHART_FRAME_CLASS =
  "h-[420px] sm:h-[520px] lg:h-[600px] overflow-x-auto overflow-y-hidden rounded-xl border border-white/5 bg-black/20 p-2 sm:p-3";

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


function filterTreemapByCategories(
  root: TreemapNode,
  excludedCategories: Set<string>,
): TreemapNode | null {
  if (excludedCategories.size === 0) return root;

  const filterNode = (node: TreemapNode): TreemapNode | null => {
    const category = node.meta?.category;

    if (category && excludedCategories.has(category)) {
      return null;
    }

    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((child): child is TreemapNode => child !== null);

      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      const val = node.value ?? node.meta?.opCount ?? 0;
      if (val === 0) return null;
    }

    const effectiveCategory = category || "other";
    if (excludedCategories.has(effectiveCategory)) {
      return null;
    }

    return node;
  };

  return filterNode(root);
}

export function NetworkTreemap() {
  const {
    data,
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
    period,
    treemapView,
    metric,
    setSelectedNode,
    selectedNode,
    activeLevelPath,
    setActiveLevelPath,
  } = useDashboard();
  const [isRetrying, setIsRetrying] = useState(false);
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(
    new Set(),
  );
  const retryPending = isRetrying || isFetching;

  const toggleCategory = (key: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetFilters = () => setExcludedCategories(new Set());

  const handleRetry = async () => {
    if (retryPending) {
      return;
    }
    setIsRetrying(true);
    try {
      await refetch();
    } finally {
      setIsRetrying(false);
    }
  };

  const activePayload = data
    ? metric === "xlm_volume"
      ? data.treemaps[`xlm_${treemapView}` as keyof typeof data.treemaps]
      : metric === "usdc"
        ? data.treemaps[`usdc_${treemapView}` as keyof typeof data.treemaps]
        : metric === "transactions"
          ? data.treemaps[`txn_${treemapView}` as keyof typeof data.treemaps]
          : data.treemaps[treemapView]
    : null;
  const activeTreemap = activePayload ? toChartNode(activePayload) : null;
  const isEmpty =
    !!activeTreemap &&
    (!activeTreemap.children || activeTreemap.children.length === 0);
  const filteredTreemap = useMemo(() => {
    if (!activeTreemap) return null;
    return filterTreemapByCategories(activeTreemap, excludedCategories);
  }, [activeTreemap, excludedCategories]);

  const filterAnnouncement =
    excludedCategories.size === 0
      ? "All categories visible"
      : `Excluded categories: ${[...excludedCategories].join(", ")}`;

  const activeViewLabel =
    TREEMAP_VIEWS.find((v) => v.id === treemapView)?.label?.toLowerCase() ||
    "activity";
  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === period)?.label?.toLowerCase() ||
    "this period";
  const metricLabel =
    metric === "xlm_volume"
      ? "XLM volume"
      : metric === "usdc"
        ? "USDC payment volume"
        : metric === "transactions"
          ? "transactions"
          : "operations";

  return (
    <Card aria-busy={isLoading || undefined}>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Network Treemap</CardTitle>
            <p className="text-xs text-zinc-500">
              Switch views to explore operation types or top accounts and
              contracts. Click legend items to filter categories.
            </p>
          </div>
          <ExportControls />
        </div>
        <TreemapViewSelector />
        <TreemapMetricSelector />
        <div className="flex flex-wrap gap-2">
          {/* Inject pattern defs so legend swatches can reference them */}
          <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
            <defs>
              {PATTERN_DEFS.map((p) => (
                <pattern
                  key={p.id}
                  id={p.id}
                  x="0"
                  y="0"
                  width={p.width}
                  height={p.height}
                  patternUnits="userSpaceOnUse"
                  patternTransform={p.patternTransform}
                >
                  {p.shapes.map((shape, i) =>
                    shape.type === "circle" ? (
                      <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} />
                    ) : (
                      <line key={i} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={shape.stroke} strokeWidth={shape.strokeWidth} />
                    )
                  )}
                </pattern>
              ))}
            </defs>
          </svg>
          {CATEGORY_LEGEND.map((item) => {
            const patternId = getCategoryPatternId(item.key);
            const isExcluded = excludedCategories.has(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleCategory(item.key)}
                aria-pressed={!isExcluded}
                aria-label={`${item.label} category filter${isExcluded ? ", excluded" : ", included"}`}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                  isExcluded
                    ? "border-transparent bg-white/5 text-zinc-500 opacity-50 hover:bg-white/10"
                    : "border-white/10 bg-white/10 text-zinc-300 hover:bg-white/20"
                }`}
              >
                {/* Compound swatch: color fill + pattern overlay */}
                <svg
                  width="14"
                  height="14"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <rect
                    width="14"
                    height="14"
                    rx="3"
                    fill={CATEGORY_COLORS[item.key]}
                  />
                  {patternId ? (
                    <rect
                      width="14"
                      height="14"
                      rx="3"
                      fill={`url(#${patternId})`}
                      opacity={PATTERN_OPACITY}
                    />
                  ) : null}
                </svg>
                {item.label}
              </button>
            );
          })}
          {excludedCategories.size > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-6 px-2 text-xs text-zinc-400 hover:text-white"
            >
              Reset
            </Button>
          ) : null}
        </div>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {filterAnnouncement}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div data-treemap-container="true"
            className={CHART_FRAME_CLASS}>
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : isError || !data || !activeTreemap || !filteredTreemap ? (
          <div className="flex h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-200 sm:h-[520px] lg:h-[600px]">
            <p role="alert">{error?.message ?? "Unable to load treemap data."}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={retryPending}
              aria-busy={retryPending}
              aria-label={
                retryPending
                  ? "Retrying network activity data"
                  : "Retry loading network activity data"
              }
              className="gap-2 border-red-500/30 text-red-100 hover:bg-red-500/10"
            >
              <RefreshCw
                className={`h-4 w-4 ${retryPending ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {retryPending ? "Retrying…" : "Retry"}
            </Button>
          </div>
        ) : (
          <div key={`${period}-${treemapView}-${metric}-${excludedCategories.size}`} className={CHART_FRAME_CLASS}>
            {!isEmpty ? (
              <D3Treemap
                root={filteredTreemap}
                onSelect={setSelectedNode}
                path={activeLevelPath}
                onPathChange={setActiveLevelPath}
              />
            ) : (
              <div
                role="status"
                aria-live="polite"
                className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm text-zinc-500"
              >
                <p className="font-medium text-zinc-300">
                  {excludedCategories.size > 0
                    ? "No categories selected."
                    : "No activity available"}
                </p>
                <p className="text-xs">
                  {excludedCategories.size > 0
                    ? "Reset filters to show all categories again."
                    : `There are no ${activeViewLabel} with ${metricLabel} for ${periodLabel}. Try another view, metric, or time range.`}
                </p>
                {excludedCategories.size > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="mt-2 text-xs text-zinc-400 hover:text-white"
                  >
                    Reset filters
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        )}
        {!isLoading && !isError && filteredTreemap
          ? (() => {
              const level = resolveActiveLevel(filteredTreemap, activeLevelPath);
              return (
                <TreemapDataTable
                  levelName={level.currentNode.name}
                  nodes={level.children}
                  levelTotal={level.levelTotal}
                  selectedNode={selectedNode}
                  onSelect={setSelectedNode}
                />
              );
            })()
          : null}
      </CardContent>
    </Card>
  );
}
