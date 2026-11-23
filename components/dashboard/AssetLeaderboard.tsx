"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { CopyableAddress } from "@/components/dashboard/CopyableAddress";
import { StellarExpertLink } from "@/components/dashboard/StellarExpertLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  rankAssetVolumes,
  sortLeaderboard,
  type LeaderboardResult,
  type LeaderboardSortKey,
} from "@/lib/assets/leaderboard";
import { formatNumber } from "@/lib/utils";

const COLUMNS: { key: LeaderboardSortKey; label: string }[] = [
  { key: "code", label: "Code" },
  { key: "issuer", label: "Issuer / SAC" },
  { key: "volume", label: "Volume" },
  { key: "opCount", label: "Op count" },
  { key: "share", label: "Share" },
];

export function AssetLeaderboardTable({ result }: { result: LeaderboardResult }) {
  const [sort, setSort] = useState<{ key: LeaderboardSortKey; direction: "asc" | "desc" }>({
    key: "volume",
    direction: "desc",
  });
  const rows = useMemo(
    () => (result.status === "ready" ? sortLeaderboard(result.rows, sort.key, sort.direction) : []),
    [result, sort],
  );

  if (result.status === "unavailable") {
    return <p role="status">{result.reason}</p>;
  }

  function choose(key: LeaderboardSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "code" || key === "issuer" ? "asc" : "desc" },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-400">
        Volumes are native units and are not converted across assets.
        {result.dropped > 0
          ? ` ${result.dropped} row${result.dropped === 1 ? "" : "s"} omitted because the amount could not be parsed.`
          : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} aria-sort={sort.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="font-semibold text-zinc-300" onClick={() => choose(column.key)}>
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.code}:${row.issuer ?? "native"}`} className="border-t border-white/10">
                <td className="py-2 pr-3 font-semibold text-white">{row.code}</td>
                <td className="py-2 pr-3">
                  {row.issuer ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase text-zinc-500">{row.kind}</span>
                      <CopyableAddress address={row.issuer} type={row.kind === "sac" ? "contract" : "account"} />
                      <StellarExpertLink address={row.issuer} type={row.kind === "sac" ? "contract" : "account"} />
                    </span>
                  ) : (
                    <span>native</span>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono">{formatNumber(row.volume)}</td>
                <td className="py-2 pr-3 font-mono">{formatNumber(row.opCount)}</td>
                <td className="py-2 font-mono">{(row.share * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AssetLeaderboard() {
  const { data, isError } = useDashboard();
  if (isError && !data) {
    return (
      <Card role="alert">
        <CardHeader><CardTitle>Asset volume leaderboard</CardTitle></CardHeader>
        <CardContent><p role="status">Asset volume rows are unavailable.</p></CardContent>
      </Card>
    );
  }
  const result = rankAssetVolumes(data?.assetVolumes ?? null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset volume leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <AssetLeaderboardTable result={result} />
      </CardContent>
    </Card>
  );
}
