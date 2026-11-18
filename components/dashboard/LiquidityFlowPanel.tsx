"use client";

import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiquidityFlowSummary } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

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

function LiquidityFlowDetails({
  summary,
}: {
  summary: LiquidityFlowSummary;
}) {
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
  const { data, isLoading } = useDashboard();
  const summary = data?.liquidityFlow;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Path payments &amp; liquidity routing</CardTitle>
        <p className="text-xs text-zinc-400">
          Path-payment notionals stay in their native units. DEX offer and pool
          operation counts are shown separately; they are not traded volume.
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
          <LiquidityFlowDetails summary={summary} />
        ) : (
          <p className="text-sm text-zinc-400">
            Path-payment and DEX summary data is unavailable for this response.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
