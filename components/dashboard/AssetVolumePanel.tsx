"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import {
  ActivityRetryButton,
  ActivityUnavailableNote,
} from "@/components/dashboard/ActivityErrorState";
import { CopyableAddress } from "@/components/dashboard/CopyableAddress";
import { StellarExpertLink } from "@/components/dashboard/StellarExpertLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ASSET_VOLUME_LEADERBOARD_FIXTURE,
  mapAssetVolumeLeaderboardRows,
  sortAssetVolumeLeaderboard,
  type AssetLeaderboardSortKey,
  type SortDirection,
} from "@/lib/metrics/asset-volume-leaderboard";
import { formatNumber, truncateAddress } from "@/lib/utils";

export function AssetVolumePanel() {
  const { data, isError, setSelectedNode, network } = useDashboard();
  const [sortKey, setSortKey] = useState<AssetLeaderboardSortKey>("opCount");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const rawRows =
    data?.assetVolumes && data.assetVolumes.length > 0
      ? data.assetVolumes
      : ASSET_VOLUME_LEADERBOARD_FIXTURE;
  const rows = data?.assetVolumes ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  const leaderboardRows = useMemo(() => {
    const mapped = mapAssetVolumeLeaderboardRows(rawRows);
    return sortAssetVolumeLeaderboard(mapped, sortKey, sortDir);
  }, [rawRows, sortKey, sortDir]);

  const toggleSort = (nextKey: AssetLeaderboardSortKey) => {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(nextKey);
      setSortDir("desc");
    }
  };

  if (isError && !data) {
    return (
      <Card role="alert" data-testid="asset-volume-error">
        <CardHeader>
          <CardTitle>Payment volume by asset</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ActivityUnavailableNote />
          <ActivityRetryButton
            testId="asset-volume-retry"
            className="shrink-0"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment volume by asset</CardTitle>
        <p className="text-xs text-zinc-400">
          Raw native units; values are not converted across assets. Issuers and
          Soroban Asset Contracts (SAC) remain distinct.{" "}
          <a
            href="/methodology#payment-volume"
            className="text-stellar-light hover:text-white underline"
          >
            Methodology
          </a>
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No asset payment volume is available for this period.
          </p>
        ) : (
          <div
            className="flex min-h-40 flex-wrap gap-2"
            aria-label="Payment volume assets"
          >
            {rows.map((row) => {
              const issuer =
                row.asset.type === "issued" ? row.asset.issuer : undefined;
              const amount = Number(row.amount);
              const share = total > 0 ? (amount / total) * 100 : 0;
              return (
                <button
                  key={`${row.asset.code}:${issuer ?? "native"}`}
                  type="button"
                  className="min-h-24 min-w-40 flex-1 rounded-lg border border-cyan-900/60 bg-cyan-950/40 p-3 text-left hover:border-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  style={{ flexGrow: Math.max(1, Math.sqrt(amount)) }}
                  onClick={() =>
                    setSelectedNode({
                      name: issuer
                        ? `${row.asset.code} · ${truncateAddress(issuer)}`
                        : "Native XLM",
                      value: amount,
                      share,
                      meta: {
                        type: "entity",
                        assetCode: row.asset.code,
                        assetIssuer: issuer,
                        assetAmount: row.amount,
                        opCount: row.opCount,
                      },
                    })
                  }
                >
                  <span className="block font-semibold text-white">
                    {row.asset.code}
                  </span>
                  <span className="block font-mono text-sm text-cyan-200">
                    {formatNumber(amount)} {row.asset.code}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-zinc-500">
                    {issuer ? truncateAddress(issuer) : "native"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* SAC and Classic Asset Volume Leaderboard Table (#448) */}
        <div
          data-testid="asset-volume-leaderboard"
          className="overflow-x-auto rounded-lg border border-white/10 bg-black/20"
        >
          <table className="w-full min-w-[38rem] text-left text-xs sm:text-sm">
            <caption className="sr-only">
              SAC and classic asset volume leaderboard
            </caption>
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort("code")}
                    className="font-medium hover:text-white"
                  >
                    Code
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">Issuer / SAC</th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("volume")}
                    className="font-medium hover:text-white"
                  >
                    Volume
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("opCount")}
                    className="font-medium hover:text-white"
                  >
                    Op Count
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("sharePercent")}
                    className="font-medium hover:text-white"
                  >
                    Op Share
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {leaderboardRows.map((row) => (
                <tr key={row.key} data-testid="asset-leaderboard-row">
                  <td className="px-3 py-2 font-mono font-semibold text-white">
                    {row.code}{" "}
                    <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-zinc-300">
                      {row.assetKind}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.issuerOrSacAddress ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedNode({
                              name:
                                row.issuerLabel ??
                                `${row.code} · ${truncateAddress(row.issuerOrSacAddress!)}`,
                              value: row.volume,
                              share: row.sharePercent,
                              meta: {
                                type:
                                  row.assetKind === "sac"
                                    ? "contract"
                                    : "account",
                                id: row.issuerOrSacAddress!,
                                assetCode: row.code,
                                assetIssuer: row.issuerOrSacAddress!,
                                opCount: row.opCount,
                              },
                            })
                          }
                          className="font-mono text-cyan-200 hover:underline"
                        >
                          {row.issuerLabel ??
                            truncateAddress(row.issuerOrSacAddress)}
                        </button>
                        <CopyableAddress
                          address={row.issuerOrSacAddress}
                          display="truncated"
                        />
                        <StellarExpertLink
                          id={row.issuerOrSacAddress}
                          type={
                            row.assetKind === "sac" ? "contract" : "account"
                          }
                          network={network}
                        />
                      </div>
                    ) : (
                      <span className="font-mono text-zinc-400">
                        Native XLM
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-100">
                    {formatNumber(row.volume)} {row.code}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">
                    {row.opCount.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">
                    {row.sharePercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
