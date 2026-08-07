"use client";

import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
} from "date-fns";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Skeleton } from "@/components/ui/skeleton";

function formatLag(dataThrough: string): string {
  const now = Date.now();
  const through = new Date(dataThrough).getTime();
  const mins = differenceInMinutes(now, through);

  if (mins < 1) return "<1m behind";
  if (mins < 60) return `${mins}m behind`;

  const hours = differenceInHours(now, through);
  if (hours < 24) {
    const remainMins = mins % 60;
    return remainMins > 0
      ? `${hours}h ${remainMins}m behind`
      : `${hours}h behind`;
  }

  const days = differenceInDays(now, through);
  return `${days}d behind`;
}

export function FreshnessIndicator() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1" aria-busy="true">
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-xs text-zinc-500">
        Data source:{" "}
        <span className="text-zinc-300">Hubble BigQuery</span>
        {" · "}
        <span className="text-amber-500">Data freshness unavailable</span>
      </p>
    );
  }

  const isFixture = data.source === "fixture" || data.fixture === true;
  const sourceTime = data.sourceTimestamp
    ? new Date(data.sourceTimestamp)
    : null;
  const periodEnd = new Date(data.end);
  const isBehind = sourceTime && periodEnd > sourceTime;
  const lag =
    sourceTime && !Number.isNaN(sourceTime.getTime())
      ? formatLag(data.sourceTimestamp)
      : null;

  if (isFixture) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-amber-400/90">
          Data source:{" "}
          <span className="text-amber-300">Local fixture data</span>
          {" · Deterministic data for local development and tests — not Hubble / mainnet"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p
        className="text-xs text-zinc-500"
        title={
          sourceTime
            ? `Data through ${data.sourceTimestamp}`
            : "Data freshness unavailable"
        }
      >
        Data source:{" "}
        <span className="text-zinc-300">Hubble BigQuery</span>
        {sourceTime ? (
          <>
            {" · Data through "}
            <span className="text-zinc-300">
              {format(sourceTime, "yyyy-MM-dd HH:mm")} UTC
            </span>
            {lag ? (
              <>
                {" · "}
                <span className="text-zinc-400">{lag}</span>
              </>
            ) : null}
          </>
        ) : (
          <>
            {" · "}
            <span className="text-amber-500">Data freshness unavailable</span>
          </>
        )}
      </p>
      {!data.isPeriodComplete && (
        <p className="text-xs text-amber-400">
          {data.period === "1d"
            ? "Today's data is still being indexed and may be incomplete."
            : "This period is still accumulating data and may be incomplete."}
        </p>
      )}
      {isBehind && (
        <p className="text-xs text-zinc-400">
          Latest available data may be delayed relative to the period end
        </p>
      )}
    </div>
  );
}
