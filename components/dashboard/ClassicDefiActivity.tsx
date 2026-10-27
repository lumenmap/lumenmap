"use client";

import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClassicDefiBreakdown } from "@/lib/types";
import { getDisplayName } from "@/lib/entities/registry";
import { formatNumber } from "@/lib/utils";

const SCOPE_TITLES: Record<ClassicDefiBreakdown["scope"], string> = {
  liquidity_pools: "Top liquidity-pool accounts",
  claimable_balances: "Top claimable-balance accounts",
};

function typeLabel(typeString: string): string {
  return typeString.replaceAll("_", " ");
}

function DefiTable({ breakdown }: { breakdown: ClassicDefiBreakdown }) {
  const types = breakdown.rows.reduce<string[]>(
    (acc, row) => acc.concat(row.byType.map((entry) => entry.type_string)),
    [],
  );
  const columns = [...new Set(types)];

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-medium text-zinc-200">
        {SCOPE_TITLES[breakdown.scope]}
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        {formatNumber(breakdown.totalOps)} operations across{" "}
        {breakdown.distinctAccounts} accounts
        {breakdown.truncated
          ? ` · showing top ${breakdown.rows.length}`
          : ""}
      </p>
      {breakdown.rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">
          No {typeLabel(breakdown.scope)} activity in this period.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Account</th>
                <th className="py-2 pr-3 font-medium">Ops</th>
                {columns.map((type) => (
                  <th key={type} className="py-2 pr-3 font-medium capitalize">
                    {typeLabel(type)}
                  </th>
                ))}
                <th className="py-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.rows.map((row) => (
                <tr key={row.accountId} className="border-t border-white/10">
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-200">
                    {getDisplayName(row.accountId)}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {formatNumber(row.ops)}
                  </td>
                  {columns.map((type) => {
                    const entry = row.byType.find(
                      (candidate) => candidate.type_string === type,
                    );
                    return (
                      <td key={type} className="py-2 pr-3 font-mono text-xs">
                        {entry ? formatNumber(entry.ops) : "—"}
                      </td>
                    );
                  })}
                  <td className="py-2 font-mono text-xs">
                    {Math.round(row.scopeShare * 10) / 10}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ClassicDefiActivity() {
  const { data, isLoading } = useDashboard();
  const breakdowns = data?.classicDeFi;

  if (!breakdowns) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>DeFi on classic</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isLoading ? (
            <>
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </>
          ) : (
            <p className="text-sm text-zinc-400" data-testid="classic-defi-activity">
              Classic DeFi account rankings are unavailable for this response.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>DeFi on classic</CardTitle>
        <p className="text-xs text-zinc-400">
          Source accounts ranked within the Liquidity Pools and Claimable
          Balances categories. Hubble exposes the operation source account but
          no pool identifier for classic operations, so pools are ranked by the
          accounts driving them rather than by pool. Operation counts, not
          traded value.
        </p>
      </CardHeader>
      <CardContent
        className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2"
        data-testid="classic-defi-activity"
      >
        <DefiTable breakdown={breakdowns.liquidityPools} />
        <DefiTable breakdown={breakdowns.claimableBalances} />
      </CardContent>
    </Card>
  );
}
