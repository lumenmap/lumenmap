"use client";

import { Download } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  serializeLiquidityFlowSplitToCsv,
  type LiquidityFlowSplitBucket,
} from "@/lib/metrics/liquidity-flow";
import { downloadBlob, generateSafeFilename } from "@/lib/export-utils";
import type {
  LiquidityFlowSplit,
  LiquidityFlowSummary,
  Period,
} from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/utils";

const SPLIT_BAR_COLORS: Record<LiquidityFlowSplitBucket, string> = {
  manage_offer: "bg-amber-500/80",
  path_payment: "bg-cyan-400/80",
  related: "bg-emerald-500/80",
};

function Amount({ value, unit }: { value: string | null; unit: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{unit}</dt>
      <dd className="mt-1 font-mono text-lg text-cyan-100">
        {value === null ? "Unavailable" : `${formatNumber(Number(value))} ${unit}`}
      </dd>
    </div>
  );
}

function SplitShareBar({ split }: { split: LiquidityFlowSplit }) {
  const ariaParts = split.rows.map(
    (row) =>
      `${row.label} ${formatNumber(row.opCount)} ops (${formatPercent(row.share * 100)})`,
  );
  const label =
    split.totalOpCount === 0
      ? "No manage-offer, path-payment, or related operations in this period"
      : `Liquidity routing share: ${ariaParts.join("; ")}`;

  return (
    <div className="space-y-2" data-testid="liquidity-flow-split-bar">
      <div
        role="img"
        aria-label={label}
        className="flex h-3 w-full overflow-hidden rounded-full bg-white/5"
      >
        {split.rows.map((row) =>
          row.share > 0 ? (
            <div
              key={row.bucket}
              className={`${SPLIT_BAR_COLORS[row.bucket]} h-full`}
              style={{ width: `${row.share * 100}%` }}
              title={`${row.label}: ${formatPercent(row.share * 100)}`}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-3 text-xs text-zinc-400">
        {split.rows.map((row) => (
          <li key={row.bucket} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm ${SPLIT_BAR_COLORS[row.bucket]}`}
              aria-hidden="true"
            />
            <span>
              {row.label} · {formatPercent(row.share * 100)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SplitShareTable({ split }: { split: LiquidityFlowSplit }) {
  return (
    <div className="overflow-x-auto" data-testid="liquidity-flow-split-table">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <caption className="sr-only">
          Manage-offer, path-payment, and related liquidity-pool operation
          shares for the selected period
        </caption>
        <thead className="text-xs text-zinc-500">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">
              Bucket
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Operations
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Share
            </th>
            <th scope="col" className="py-2 font-medium">
              Subtypes
            </th>
          </tr>
        </thead>
        <tbody>
          {split.rows.map((row) => (
            <tr key={row.bucket} className="border-t border-white/10">
              <th scope="row" className="py-2 pr-3 font-medium text-zinc-200">
                {row.label}
              </th>
              <td className="py-2 pr-3 font-mono text-xs text-zinc-300">
                {formatNumber(row.opCount)}
              </td>
              <td className="py-2 pr-3 font-mono text-xs text-zinc-300">
                {formatPercent(row.share * 100)}
              </td>
              <td className="py-2 text-xs text-zinc-400">
                {row.subtypes
                  .map((subtype) =>
                    subtype.available
                      ? `${subtype.type.replaceAll("_", " ")} (${formatNumber(subtype.opCount)})`
                      : `${subtype.type.replaceAll("_", " ")} (missing)`,
                  )
                  .join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {split.missingSubtypes.length > 0 ? (
        <p className="mt-2 text-xs text-zinc-500" role="status">
          Missing subtypes soft-failed to zero:{" "}
          {split.missingSubtypes.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

function LiquidityFlowDetails({
  summary,
  period,
}: {
  summary: LiquidityFlowSummary;
  period: Period;
}) {
  const handleExportCsv = () => {
    const csv = serializeLiquidityFlowSplitToCsv(summary.split);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(
      blob,
      generateSafeFilename(
        "lumenmap-liquidity-flow",
        "dex-path-split",
        period,
        "csv",
      ),
    );
  };

  return (
    <>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-zinc-500">Path payments</dt>
          <dd className="mt-1 font-mono text-lg text-white">
            {formatNumber(summary.pathPaymentCount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">DEX offer operations</dt>
          <dd className="mt-1 font-mono text-lg text-white">
            {formatNumber(summary.dexOperationCount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Liquidity-pool operations</dt>
          <dd className="mt-1 font-mono text-lg text-white">
            {formatNumber(summary.liquidityPoolOperationCount)}
          </dd>
        </div>
      </dl>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-zinc-400">
            Manage-offer / path-payment / related share
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            aria-label="Export liquidity flow split as CSV"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            CSV
          </Button>
        </div>
        <SplitShareBar split={summary.split} />
        <SplitShareTable split={summary.split} />
      </div>

      <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium text-zinc-400">
            Path-payment notional
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <Amount
              value={summary.pathPaymentAmounts?.xlmAmount ?? null}
              unit="XLM"
            />
            <Amount
              value={summary.pathPaymentAmounts?.usdcAmount ?? null}
              unit="USDC"
            />
          </dl>
        </div>
        <div>
          <h3 className="text-xs font-medium text-zinc-400">
            Top intermediate assets
          </h3>
          {!summary.intermediateAssetsAvailable ? (
            <p className="mt-2 text-sm text-zinc-500">
              Route asset details are unavailable from Hubble.
            </p>
          ) : summary.intermediateAssets.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              No intermediate assets were reported for this period.
            </p>
          ) : (
            <ol className="mt-2 space-y-1">
              {summary.intermediateAssets.slice(0, 5).map((asset) => (
                <li
                  key={`${asset.code}:${asset.issuer ?? "native"}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-zinc-200">
                    {asset.code}
                    {asset.issuer ? (
                      <span className="ml-1 text-xs text-zinc-500">
                        · {asset.issuer}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-zinc-400">
                    {formatNumber(asset.routeAppearances)} appearances
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

export function LiquidityFlowPanel() {
  const { data, isLoading, period } = useDashboard();
  const summary = data?.liquidityFlow;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Path payments &amp; liquidity routing</CardTitle>
        <p className="text-xs text-zinc-400">
          Path-payment notionals stay in their native units. DEX offer and pool
          operation counts are shown separately; they are not traded volume. The
          share split groups manage offers, path payments, and related pool ops.
          <a
            href="/methodology#liquidity-flow"
            className="ml-1 text-stellar-light hover:text-white"
          >
            Methodology
          </a>
        </p>
      </CardHeader>
      <CardContent className="space-y-5" data-testid="liquidity-flow-panel">
        {!summary && isLoading ? (
          <Skeleton className="h-36 w-full rounded-xl" />
        ) : summary ? (
          <LiquidityFlowDetails summary={summary} period={period} />
        ) : (
          <p className="text-sm text-zinc-400">
            Path-payment and DEX summary data is unavailable for this response.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
