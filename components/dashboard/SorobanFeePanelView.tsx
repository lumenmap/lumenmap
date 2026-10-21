"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { truncateAddress } from "@/lib/utils";
import type {
  SorobanFeeAnalytics,
  SorobanFeeAvailable,
} from "@/lib/soroban-fees/types";

const STROOPS_PER_XLM = 10_000_000;

function formatStroops(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatXlm(stroops: number): string {
  return `${(stroops / STROOPS_PER_XLM).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} XLM`;
}

function Kpi({
  label,
  value,
  detail,
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4"
    >
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 break-words font-mono text-lg text-white sm:text-xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

export function SorobanFeePanelView({
  result,
}: {
  result: SorobanFeeAnalytics;
}) {
  if (result.status === "unavailable") {
    return (
      <Card data-testid="soroban-fee-panel">
        <CardHeader>
          <CardTitle>Soroban fees and resources</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            role="status"
            data-testid="soroban-fee-unavailable"
            className="text-sm text-zinc-300"
          >
            {result.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <AvailablePanel result={result} />;
}

function AvailablePanel({ result }: { result: SorobanFeeAvailable }) {
  const avg =
    result.avgResourceStroopsPerInvoke == null
      ? "—"
      : formatStroops(result.avgResourceStroopsPerInvoke);

  return (
    <Card data-testid="soroban-fee-panel">
      <CardHeader>
        <CardTitle>Soroban fees and resources</CardTitle>
        <p className="text-xs text-zinc-400">
          {result.source === "fixture" ? "Fixture sample. " : ""}
          Selected period fees in stroops, plus the contracts charged the most.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi
            testId="soroban-fee-total"
            label="Total fees"
            value={formatStroops(result.totalFeeStroops)}
            detail={`${formatXlm(result.totalFeeStroops)} · stroops`}
          />
          <Kpi
            testId="soroban-fee-avg"
            label="Avg resources per invoke"
            value={avg}
            detail="non-refundable resource fee, stroops"
          />
          <Kpi
            testId="soroban-fee-invokes"
            label="Invokes"
            value={formatStroops(result.invokeCount)}
            detail="transactions in the hourly aggregate"
          />
        </div>

        {result.topContracts.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No contracts with a fee total in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">
                Top contracts by charged Soroban fee
              </caption>
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Contract</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Fee (stroops)
                  </th>
                  <th className="px-2 py-2 text-right font-medium">Invokes</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Resources
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.topContracts.map((row) => (
                  <tr
                    key={row.contractId}
                    className="border-t border-white/10"
                    data-testid="soroban-fee-contract"
                  >
                    <td className="px-2 py-2 font-mono text-xs text-cyan-100 sm:text-sm">
                      <span className="sm:hidden">
                        {truncateAddress(row.contractId, 4)}
                      </span>
                      <span className="hidden sm:inline">{row.contractId}</span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-zinc-100">
                      {formatStroops(row.totalFeeStroops)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-zinc-300">
                      {formatStroops(row.invokeCount)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-zinc-300">
                      {formatStroops(row.resourceStroops)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p
          className="text-xs leading-relaxed text-zinc-500"
          data-testid="soroban-fee-note"
        >
          {result.note}{" "}
          <a
            href="/methodology#soroban-fees"
            className="text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
          >
            Methodology
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
