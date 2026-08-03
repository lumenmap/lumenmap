"use client";

import { useMemo, useState } from "react";
import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  subMonths,
  addMonths,
  format,
  isToday,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DailyActivityRow } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarHeatmapProps {
  data: DailyActivityRow[];
  isLoading?: boolean;
}

function getColor(opacity: number): string {
  return `rgba(123, 97, 255, ${opacity})`;
}

export function CalendarHeatmap({ data, isLoading }: CalendarHeatmapProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Start from the most recent month in data, or current month
    if (data.length > 0) {
      const lastDate = new Date(data[data.length - 1].date);
      return startOfMonth(lastDate);
    }
    return startOfMonth(new Date());
  });

  const [tooltip, setTooltip] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data) {
      map.set(row.date.slice(0, 10), row.op_count);
    }
    return map;
  }, [data]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentMonth]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const row of data) {
      if (row.op_count > max) max = row.op_count;
    }
    return max || 1;
  }, [data]);

  const weeks = useMemo(() => {
    const result: (Date | null)[][] = [];
    const pad = getDay(days[0]);
    let week: (Date | null)[] = [];

    for (let i = 0; i < pad; i++) {
      week.push(null);
    }

    for (const day of days) {
      week.push(day);
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      result.push(week);
    }

    return result;
  }, [days]);

  const today = useMemo(() => new Date(), []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daily Activity</CardTitle>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium text-zinc-300">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="text-center text-[10px] font-medium text-zinc-500"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={`empty-${wi}-${di}`} className="h-8" />;
                  }

                  const dateStr = format(day, "yyyy-MM-dd");
                  const count = activityMap.get(dateStr) ?? 0;
                  const isPartial = isToday(day) && count === 0;
                  const hasData = activityMap.has(dateStr);
                  const isToday_ = isSameDay(day, today);

                  let opacity = 0;
                  if (isPartial) {
                    opacity = 0;
                  } else if (hasData) {
                    opacity = 0.15 + (count / maxCount) * 0.85;
                  } else {
                    opacity = 0.04;
                  }

                  return (
                    <div
                      key={dateStr}
                      className={`relative h-8 w-full rounded-sm ${
                        isToday_ ? "ring-1 ring-white/30" : ""
                      }`}
                      style={{
                        backgroundColor: `rgba(123, 97, 255, ${opacity})`,
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          date: format(day, "MMM d, yyyy"),
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
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-zinc-500">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,0.04)]" />
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,0.25)]" />
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,0.5)]" />
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,0.75)]" />
            <div className="h-3 w-3 rounded-sm bg-[rgba(123,97,255,1)]" />
            <span>More</span>
          </div>
        </div>
        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="font-medium">{tooltip.date}</p>
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
