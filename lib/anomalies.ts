/**
 * KPI anomaly thresholds.
 *
 * A banner fires when the absolute change OR the percent change exceeds the
 * documented threshold. Missing baselines and incomplete periods never fire.
 */
export const ANOMALY_THRESHOLDS = {
  ops: { absolute: 10_000, percent: 25 },
  activeWallets: { absolute: 200, percent: 20 },
  sorobanShare: { absolute: 8, percent: 15 },
} as const;

export type AnomalyMetric = keyof typeof ANOMALY_THRESHOLDS;

export type KpiSnapshot = {
  ops: number | null;
  activeWallets: number | null;
  sorobanShare: number | null;
};

export type Anomaly = {
  metric: AnomalyMetric;
  absolute: number;
  percent: number | null;
  direction: "spike" | "crash";
  inspectHref: string;
};

export function detectKpiAnomalies(input: {
  current: KpiSnapshot | null;
  baseline: KpiSnapshot | null;
  complete: boolean;
}): Anomaly[] {
  if (!input.complete || !input.current || !input.baseline) return [];

  const findings: Anomaly[] = [];

  for (const metric of Object.keys(ANOMALY_THRESHOLDS) as AnomalyMetric[]) {
    const current = input.current[metric];
    const baseline = input.baseline[metric];
    if (current === null || baseline === null) continue;

    const absolute = current - baseline;
    const percent = baseline === 0 ? null : (absolute / baseline) * 100;
    const threshold = ANOMALY_THRESHOLDS[metric];
    const percentHit = percent !== null && Math.abs(percent) >= threshold.percent;
    const absoluteHit = Math.abs(absolute) >= threshold.absolute;

    if (!percentHit && !absoluteHit) continue;

    findings.push({
      metric,
      absolute,
      percent,
      direction: absolute >= 0 ? "spike" : "crash",
      inspectHref: inspectHrefFor(metric),
    });
  }

  return findings;
}

function inspectHrefFor(metric: AnomalyMetric): string {
  if (metric === "ops") return "/?metric=ops#activity-analysis";
  if (metric === "activeWallets") return "/?metric=ops#kpi-active-wallets";
  return "/?metric=ops#category-share";
}

export const SPIKE_FIXTURE = {
  current: { ops: 80_000, activeWallets: 2_000, sorobanShare: 60 },
  baseline: { ops: 40_000, activeWallets: 1_000, sorobanShare: 40 },
  complete: true,
} as const;

export const QUIET_FIXTURE = {
  current: { ops: 40_100, activeWallets: 1_010, sorobanShare: 41 },
  baseline: { ops: 40_000, activeWallets: 1_000, sorobanShare: 40 },
  complete: true,
} as const;
