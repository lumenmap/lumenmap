import type { ActivityVisualizationResponse } from "@/lib/types";

export interface NarrativeBullet {
  id: string;
  text: string;
  chartHref?: string;
  metric?: string;
}

export interface WhatChangedNarrative {
  bullets: NarrativeBullet[];
  periodLabel: string;
  comparePeriodLabel: string;
}

export interface NarrativeInput {
  current: ActivityVisualizationResponse | null | undefined;
  baseline: ActivityVisualizationResponse | null | undefined;
  periodLabel?: string;
  comparePeriodLabel?: string;
}

function signedPp(deltaPp: number): string {
  const rounded = Math.round(deltaPp);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}pp`;
}

function signedPercent(pct: number): string {
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function formatCompactNumber(num: number): string {
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return num.toLocaleString("en-US");
}

export function generateWhatChangedNarrative(input: NarrativeInput): WhatChangedNarrative | null {
  const { current, baseline, periodLabel = "Current period", comparePeriodLabel = "Previous period" } = input;

  // Escape hatch: Card hidden rather than wrong when comparison baseline missing or data incomplete
  if (!current || !baseline) return null;
  if (!current.isPeriodComplete || !baseline.isPeriodComplete) return null;
  if (!current.kpis || !baseline.kpis) return null;

  const bullets: NarrativeBullet[] = [];

  // 1. Soroban share delta bullet
  const currentSorobanShare = current.kpis.sorobanShare?.value;
  const baselineSorobanShare = baseline.kpis.sorobanShare?.value;
  if (
    typeof currentSorobanShare === "number" &&
    typeof baselineSorobanShare === "number" &&
    !isNaN(currentSorobanShare) &&
    !isNaN(baselineSorobanShare)
  ) {
    const deltaPp = currentSorobanShare - baselineSorobanShare;
    const diff = Math.round(deltaPp);
    const signWord = diff > 0 ? "expanded" : diff < 0 ? "contracted" : "held steady";
    const deltaStr = signedPp(deltaPp);
    bullets.push({
      id: "soroban-share",
      text: `Soroban share ${deltaStr} to ${Math.round(currentSorobanShare)}% (${signWord} vs baseline).`,
      chartHref: "/?metric=ops#category-share",
      metric: "sorobanShare",
    });
  }

  // 2. Payments volume / leading asset bullet
  // Check if USDC or XLM volume exists
  const currentUsdcAmount = current.usdcPaymentVolume?.amount ?? 0;
  const baselineUsdcAmount = baseline.usdcPaymentVolume?.amount ?? 0;
  const currentAssetVolumes = current.assetVolumes ?? [];

  if (currentUsdcAmount > 0 || currentAssetVolumes.length > 0) {
    // Find top asset
    let topAssetName = "USDC";
    let topAssetAmount = currentUsdcAmount;

    for (const row of currentAssetVolumes) {
      const code = row.asset?.code || (row.asset?.type === "native" ? "XLM" : "Unknown");
      const val = parseFloat(row.amount) || 0;
      if (val > topAssetAmount) {
        topAssetAmount = val;
        topAssetName = code;
      }
    }

    if (baselineUsdcAmount > 0 && currentUsdcAmount > 0) {
      const usdcDeltaPct = ((currentUsdcAmount - baselineUsdcAmount) / baselineUsdcAmount) * 100;
      bullets.push({
        id: "payments-volume",
        text: `Payments volume led by ${topAssetName} (${formatCompactNumber(currentUsdcAmount)} USDC, ${signedPercent(usdcDeltaPct)}).`,
        chartHref: "/?metric=usdc#volume",
        metric: "paymentsVolume",
      });
    } else {
      bullets.push({
        id: "payments-volume",
        text: `Payments volume led by ${topAssetName}${currentUsdcAmount > 0 ? ` (${formatCompactNumber(currentUsdcAmount)} USDC)` : ""}.`,
        chartHref: "/?metric=usdc#volume",
        metric: "paymentsVolume",
      });
    }
  }

  // 3. Total operations delta
  const currentOps = current.kpis.totalOps?.value;
  const baselineOps = baseline.kpis.totalOps?.value;
  if (
    typeof currentOps === "number" &&
    typeof baselineOps === "number" &&
    baselineOps > 0
  ) {
    const deltaOpsPct = ((currentOps - baselineOps) / baselineOps) * 100;
    const signWord = deltaOpsPct >= 0 ? "up" : "down";
    bullets.push({
      id: "total-ops",
      text: `Total operations reached ${formatCompactNumber(currentOps)} (${signWord} ${signedPercent(deltaOpsPct)}).`,
      chartHref: "/?metric=ops#activity-analysis",
      metric: "totalOps",
    });
  }

  // 4. Active wallets delta
  const currentWallets = current.kpis.activeWallets?.value;
  const baselineWallets = baseline.kpis.activeWallets?.value;
  if (
    typeof currentWallets === "number" &&
    typeof baselineWallets === "number" &&
    baselineWallets > 0
  ) {
    const deltaWalletsPct = ((currentWallets - baselineWallets) / baselineWallets) * 100;
    const signWord = deltaWalletsPct >= 0 ? "grew" : "fell";
    bullets.push({
      id: "active-wallets",
      text: `Active wallets ${signWord} to ${formatCompactNumber(currentWallets)} (${signedPercent(deltaWalletsPct)}).`,
      chartHref: "/?metric=ops#kpi-active-wallets",
      metric: "activeWallets",
    });
  }

  // 5. Active contracts or top category
  if (current.kpis.topCategory) {
    bullets.push({
      id: "top-category",
      text: `Dominant activity category remained ${current.kpis.topCategory}.`,
      chartHref: "/?metric=ops#category-share",
      metric: "topCategory",
    });
  } else if (current.kpis.activeContracts?.value) {
    bullets.push({
      id: "active-contracts",
      text: `${formatCompactNumber(current.kpis.activeContracts.value)} active contracts interacted with during the period.`,
      chartHref: "/?metric=ops#activity-analysis",
      metric: "activeContracts",
    });
  }

  // Ensure 3-5 bullets
  if (bullets.length < 3) {
    // If not enough stable metrics are present, do not invent metrics
    return null;
  }

  return {
    bullets: bullets.slice(0, 5),
    periodLabel,
    comparePeriodLabel,
  };
}
