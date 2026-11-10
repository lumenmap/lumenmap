"use client";

import type { NetworkFeePressureSummary } from "@/lib/soroban-fees/fee-pressure";

function formatStroops(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} stroops`;
}

export function NetworkFeePressurePanelView({
  summary,
}: {
  summary: NetworkFeePressureSummary;
}) {
  // Hidden when both classic and Soroban series are unavailable
  if (
    summary.reason === "both_unavailable" ||
    (summary.status === "available" &&
      !summary.classicAvailable &&
      !summary.sorobanAvailable)
  ) {
    return null;
  }

  if (summary.status === "unavailable") {
    return (
      <div
        data-testid="network-fee-pressure-unavailable"
        className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-zinc-400"
      >
        {summary.message ??
          "Network fee pressure could not be loaded for this period."}
      </div>
    );
  }

  const peakFee = Math.max(summary.peakFeeStroops ?? 0, 1);
  const peakOps = Math.max(summary.peakOpCount, 1);

  return (
    <div
      data-testid="network-fee-pressure-panel"
      className="rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">
            Classic &amp; Soroban Fee Pressure ({summary.unit})
          </p>
          <p className="text-xs text-zinc-500">
            Correlates classic fee stats and Soroban resource fees with period
            operation volume.
          </p>
        </div>
        {summary.opFeeCorrelation !== null && (
          <span
            data-testid="fee-pressure-correlation"
            className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-cyan-200"
          >
            r = {summary.opFeeCorrelation.toFixed(2)} vs ops
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          data-testid="fee-pressure-classic-total"
          className="rounded border border-white/10 bg-black/20 p-2.5"
        >
          <p className="text-[11px] text-zinc-400">Classic fees (stroops)</p>
          <p className="mt-0.5 font-mono text-sm text-white">
            {formatStroops(summary.totalClassicFeeStroops)}
          </p>
        </div>
        <div
          data-testid="fee-pressure-soroban-total"
          className="rounded border border-white/10 bg-black/20 p-2.5"
        >
          <p className="text-[11px] text-zinc-400">
            Soroban resource fees (stroops)
          </p>
          <p className="mt-0.5 font-mono text-sm text-white">
            {formatStroops(summary.totalSorobanResourceFeeStroops)}
          </p>
        </div>
        <div
          data-testid="fee-pressure-peak-bucket"
          className="rounded border border-white/10 bg-black/20 p-2.5"
        >
          <p className="text-[11px] text-zinc-400">Peak bucket fee (stroops)</p>
          <p className="mt-0.5 font-mono text-sm text-white">
            {formatStroops(summary.peakFeeStroops)}
          </p>
        </div>
      </div>

      {summary.points.length > 0 && (
        <div
          data-testid="fee-pressure-sparkline"
          className="mt-3 flex items-end gap-1.5 pt-2"
          aria-label="Fee pressure and operation count sparkline"
        >
          {summary.points.map((pt) => {
            const combined =
              (pt.classicFeeStroops ?? 0) +
              (pt.sorobanResourceFeeStroops ?? 0);
            const feeHeightPct = Math.max(
              8,
              Math.round((combined / peakFee) * 100),
            );
            const opHeightPct = Math.max(
              8,
              Math.round((pt.opCount / peakOps) * 100),
            );
            return (
              <div
                key={pt.bucketStart}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${pt.bucketStart}: ${combined.toLocaleString("en-US")} stroops · ${pt.opCount.toLocaleString("en-US")} ops`}
              >
                <div className="flex h-10 w-full items-end justify-center gap-0.5">
                  <div
                    className="w-1/2 rounded-t bg-cyan-400/70"
                    style={{ height: `${feeHeightPct}%` }}
                  />
                  <div
                    className="w-1/2 rounded-t bg-amber-400/60"
                    style={{ height: `${opHeightPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
