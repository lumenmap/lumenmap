"use client";

import { HORIZON_FALLBACK_BANNER_TEXT } from "@/lib/horizon/fallback";

export interface HorizonFallbackBannerProps {
  active: boolean;
}

export function HorizonFallbackBanner({ active }: HorizonFallbackBannerProps) {
  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="horizon-fallback-banner"
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200"
    >
      <span className="font-semibold">{HORIZON_FALLBACK_BANNER_TEXT}</span>
      <span className="text-amber-300/90">
        Primary BigQuery Hubble dataset is unavailable; displaying reduced
        Horizon ledger operation estimate without mixing Hubble tiles.
      </span>
    </div>
  );
}
