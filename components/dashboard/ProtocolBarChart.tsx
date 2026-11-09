"use client";

import { useMemo, useState } from "react";
import { BarChart3, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import {
  PROTOCOL_TAG_LABELS,
  PROTOCOL_TAXONOMY_TAGS,
  filterProtocolBarsByTags,
} from "@/lib/entities/taxonomy";
import { TOP_PROTOCOLS } from "@/lib/constants";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { ProtocolBar, ProtocolTag } from "@/lib/types";

const PROTOCOL_COLORS = [
  "#7B61FF",
  "#14B8A6",
  "#F59E0B",
  "#3B82F6",
  "#EC4899",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
  "#10B981",
  "#EF4444",
  "#6366F1",
  "#84CC16",
  "#E11D48",
  "#0EA5E9",
  "#A855F7",
];

export function ProtocolBarChart() {
  const { data, isLoading, isError, error } = useDashboard();
  const [selectedTags, setSelectedTags] = useState<Set<ProtocolTag>>(new Set());

  const toggleTag = (tag: ProtocolTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const { topBars, otherAgg, maxValue, coverage, totalOps, unknownCount, otherCount } =
    useMemo(() => {
      if (!data?.protocols?.bars) {
        return {
          topBars: [],
          otherAgg: null,
          maxValue: 0,
          coverage: 0,
          totalOps: 0,
          unknownCount: 0,
          otherCount: 0,
        };
      }

      const bars = filterProtocolBarsByTags(data.protocols.bars, selectedTags);
      const top = bars.slice(0, TOP_PROTOCOLS);
      const rest = bars.slice(TOP_PROTOCOLS);

      const other = rest.reduce(
        (acc, b) => {
          acc.opCount += b.opCount;
          acc.entityCount += b.entityCount;
          return acc;
        },
        { opCount: 0, entityCount: 0 },
      );

      return {
        topBars: top,
        otherAgg: other.opCount > 0 ? other : null,
        maxValue: top[0]?.opCount ?? 0,
        coverage: data.protocols.coverage,
        totalOps: data.protocols.totalOps,
        unknownCount: data.protocols.unknownCount,
        otherCount: rest.length,
      };
    }, [data, selectedTags]);

  const barWidth = (value: number) =>
    maxValue > 0 ? `${(value / maxValue) * 100}%` : "0%";

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Protocol Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-200">
            {error?.message ?? "Unable to load protocol data."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Protocol Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Protocol Activity</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              Ranked protocols by operation count · showing top {TOP_PROTOCOLS}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
            <BarChart3 className="h-4 w-4 text-stellar-light" />
            <span className="text-xs font-medium text-zinc-300">
              {formatPercent(coverage)} labeled
            </span>
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter protocols by taxonomy tag"
        >
          {PROTOCOL_TAXONOMY_TAGS.map((tag) => {
            const active = selectedTags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-stellar-light/60 bg-stellar-light/20 text-white"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                {PROTOCOL_TAG_LABELS[tag]}
              </button>
            );
          })}
          {selectedTags.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags(new Set())}
              className="px-2 py-0.5 text-xs text-zinc-400 hover:text-white"
            >
              Clear tags
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {topBars.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-zinc-500">
            {selectedTags.size > 0
              ? "No protocols match the selected taxonomy tags."
              : "No protocol activity data available for this period."}
          </div>
        ) : (
          <div className="space-y-1">
            {topBars.map((bar: ProtocolBar, index: number) => {
              const isUnknown = bar.protocol === "Unknown";
              const color =
                PROTOCOL_COLORS[index % PROTOCOL_COLORS.length];

              return (
                <div
                  key={bar.protocol}
                  className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/5"
                >
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-zinc-500">
                    {bar.rank}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {isUnknown ? (
                          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        ) : (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        )}
                        <span
                          className="truncate text-sm font-medium text-zinc-200 group-hover:text-white"
                          title={bar.protocol}
                        >
                          {bar.protocol}
                        </span>
                        {bar.tags && bar.tags.length > 0 && (
                          <span className="hidden gap-1 sm:inline-flex">
                            {bar.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-white/5 px-1.5 py-0.2 text-[10px] text-zinc-400"
                              >
                                {PROTOCOL_TAG_LABELS[tag]}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-right text-xs tabular-nums text-zinc-400">
                        {formatNumber(bar.opCount)}{" "}
                        <span className="text-zinc-600">
                          ({formatPercent(bar.share)})
                        </span>
                      </span>
                    </div>

                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-300 ease-out"
                        style={{
                          width: barWidth(bar.opCount),
                          backgroundColor: isUnknown
                            ? "#52525B"
                            : color,
                          opacity: isUnknown ? 0.6 : 0.85,
                        }}
                      />
                    </div>

                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600">
                        {bar.entityCount}{" "}
                        {bar.entityCount === 1 ? "entity" : "entities"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {otherAgg !== null && (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">
                +{otherCount} other protocols
              </span>
              <span className="text-xs tabular-nums text-zinc-400">
                {formatNumber(otherAgg.opCount)} ops ·{" "}
                {otherAgg.entityCount} entities
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Coverage</span>
            <span className="text-xs font-medium text-zinc-300">
              {formatPercent(coverage)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span>
              {formatNumber(totalOps)} total ops
            </span>
            {unknownCount > 0 ? (
              <span>
                {unknownCount} unknown {unknownCount === 1 ? "entity" : "entities"}
              </span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
