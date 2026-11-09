"use client";

import { useMemo, useState } from "react";
import { CopyableAddress } from "@/components/dashboard/CopyableAddress";
import { StellarExpertLink } from "@/components/dashboard/StellarExpertLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FIXTURE_ASSET_LEADERBOARD_ROWS,
  mapAssetLeaderboardRows,
  sortAssetLeaderboard,
  type AssetLeaderboardSortKey,
  type RawAssetLeaderboardRow,
  type SortDirection,
} from "@/lib/assets/leaderboard";

export interface AssetVolumeLeaderboardPanelProps {
  rows?: readonly RawAssetLeaderboardRow[];
  onSelectEntity?: (entry: {
    code: string;
    address: string | null;
    kind: "native" | "classic" | "sac";
  }) => void;
}

export function AssetVolumeLeaderboardPanel({
  rows = FIXTURE_ASSET_LEADERBOARD_ROWS,
  onSelectEntity,
}: AssetVolumeLeaderboardPanelProps) {
  const [sortKey, setSortKey] = useState<AssetLeaderboardSortKey>("volume");
  const [direction, setDirection] = useState<SortDirection>("desc");

  const entries = useMemo(() => {
    const mapped = mapAssetLeaderboardRows(rows);
    return sortAssetLeaderboard(mapped, sortKey, direction);
  }, [rows, sortKey, direction]);

  const toggleSort = (key: AssetLeaderboardSortKey) => {
    if (sortKey === key) {
      setDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  };

  if (entries.length === 0) {
    return (
      <Card data-testid="asset-leaderboard-empty">
        <CardHeader>
          <CardTitle>SAC &amp; classic asset volume leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="status" className="text-xs text-text-muted">
            Asset leaderboard data is unavailable for this period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="asset-volume-leaderboard-panel">
      <CardHeader>
        <CardTitle>SAC &amp; classic asset volume leaderboard</CardTitle>
        <p className="text-xs text-text-muted">
          Ranked by native asset volume and operation share across classic
          issuers and Stellar Asset Contracts (SAC).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <caption className="sr-only">
              Top SAC and classic assets by payment volume and operation count
            </caption>
            <thead className="uppercase text-text-muted">
              <tr>
                <th className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort("code")}
                    className="font-semibold hover:text-text-primary"
                  >
                    Code
                  </button>
                </th>
                <th className="px-2 py-2">Issuer / SAC</th>
                <th className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("volume")}
                    className="font-semibold hover:text-text-primary"
                  >
                    Volume
                  </button>
                </th>
                <th className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("opCount")}
                    className="font-semibold hover:text-text-primary"
                  >
                    Op count
                  </button>
                </th>
                <th className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("share")}
                    className="font-semibold hover:text-text-primary"
                  >
                    Share
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  data-testid="asset-leaderboard-row"
                  className="border-t border-border/60"
                >
                  <td className="px-2 py-2 font-mono font-semibold text-text-primary">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectEntity?.({
                          code: entry.code,
                          address: entry.address,
                          kind: entry.kind,
                        })
                      }
                      className="hover:underline"
                    >
                      {entry.code}
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-text-secondary">
                        {entry.displayIssuer}
                      </span>
                      {entry.address ? (
                        <>
                          <CopyableAddress
                            address={entry.address}
                            type={entry.kind === "sac" ? "contract" : "account"}
                          />
                          <StellarExpertLink
                            address={entry.address}
                            type={entry.kind === "sac" ? "contract" : "account"}
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-text-primary">
                    {entry.volume.toLocaleString("en-US")}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-text-secondary">
                    {entry.opCount.toLocaleString("en-US")}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-text-secondary">
                    {entry.sharePercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted">
          Amounts reflect raw native asset units within safe IEEE-754 bounds;
          cross-asset USD conversion is intentionally excluded.{" "}
          <a
            href="/methodology#asset-volume-leaderboard"
            className="underline hover:text-text-primary"
          >
            Methodology
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
