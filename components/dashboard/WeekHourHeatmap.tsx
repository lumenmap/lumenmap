"use client";

import { useMemo, useState } from "react";
import type { WeekHourRow } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

interface WeekHourHeatmapProps {
  data: WeekHourRow[];
  isLoading?: boolean;
}

export function WeekHourHeatmap({ data, isLoading }: WeekHourHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    weekday: string;
    hour: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const grid = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data) {
      map.set(`${row.weekday}-${row.hour}`, row.op_count);
    }
    return map;
  }, [data]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const row of data) {
      if (row.op_count > max) max = row.op_count;
    }
    return max || 1;
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity by Hour of Week (UTC)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity by Hour of Week (UTC)</CardTitle>
        <p className="text-xs text-zinc-500">
          Each cell shows total operations for a UTC weekday and hour.
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-x-auto">
          <div className="inline-flex min-w-full flex-col gap-1">
            {/* Hour headers */}
            <div className="flex items-center gap-1 pl-12">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex h-5 w-8 shrink-0 items-center justify-center text-[9px] font-medium text-zinc-500"
                  title={`${hour}:00`}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Weekday rows */}
            {WEEKDAYS.map((weekday, wi) => (
              <div key={weekday} className="flex items-center gap-1">
                <div className="w-10 shrink-0 text-right text-[10px] font-medium text-zinc-500">
                  {weekday}
                </div>
                {HOURS.map((hour) => {
                  const count = grid.get(`${wi}-${hour}`) ?? 0;
                  const hasData = grid.has(`${wi}-${hour}`);

                  let opacity = 0;
                  if (hasData) {
                    opacity = 0.1 + (count / maxCount) * 0.9;
                  } else {
                    opacity = 0.03;
                  }

                  return (
                    <div
                      key={`${wi}-${hour}`}
                      className="h-8 w-8 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: `rgba(123, 97, 255, ${opacity})`,
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          weekday,
                          hour: `${hour}:00`,
                          count: hasData ? count : -1,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Scale legend */}
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-zinc-500">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,0.03)]" />
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,0.25)]" />
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,0.5)]" />
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,0.75)]" />
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,1)]" />
            <span>More</span>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="font-medium">
              {tooltip.weekday} {tooltip.hour} UTC
            </p>
            <p className="text-zinc-400">
              {tooltip.count >= 0
                ? `${tooltip.count.toLocaleString()} operations`
                : "No data"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
