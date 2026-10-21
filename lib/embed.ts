export type EmbedFramePolicy = {
  contentSecurityPolicy: string;
  blocksUnknownParents: boolean;
};

/**
 * Build the embed frame policy.
 * An empty allowlist keeps local harnesses working (`frame-ancestors *`).
 * A configured allowlist permits only those parents plus same-origin.
 */
export function buildEmbedFramePolicy(allowlist: string | undefined): EmbedFramePolicy {
  const ancestors = (allowlist ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (ancestors.length === 0) {
    return {
      contentSecurityPolicy: "frame-ancestors *",
      blocksUnknownParents: false,
    };
  }

  return {
    contentSecurityPolicy: `frame-ancestors 'self' ${ancestors.join(" ")}`,
    blocksUnknownParents: true,
  };
}

export const EMBED_PERIODS = ["1d", "7d", "30d"] as const;
export const EMBED_METRICS = ["ops", "xlm_volume"] as const;

export type EmbedPeriod = (typeof EMBED_PERIODS)[number];
export type EmbedMetric = (typeof EMBED_METRICS)[number];

export function parseEmbedQuery(input: { period?: string; metric?: string }): {
  period: EmbedPeriod;
  metric: EmbedMetric;
} {
  const period = EMBED_PERIODS.includes(input.period as EmbedPeriod)
    ? (input.period as EmbedPeriod)
    : "7d";
  const metric = EMBED_METRICS.includes(input.metric as EmbedMetric)
    ? (input.metric as EmbedMetric)
    : "ops";
  return { period, metric };
}

export type EmbedKpi = { label: string; value: string };

const FIXTURE_KPIS: Record<EmbedPeriod, Record<EmbedMetric, EmbedKpi[]>> = {
  "1d": {
    ops: [
      { label: "Operations", value: "12,400" },
      { label: "Active wallets", value: "860" },
      { label: "Soroban share", value: "41%" },
    ],
    xlm_volume: [
      { label: "XLM volume", value: "1.2M" },
      { label: "Payments", value: "3,100" },
      { label: "Median fee", value: "0.0001" },
    ],
  },
  "7d": {
    ops: [
      { label: "Operations", value: "84,200" },
      { label: "Active wallets", value: "4,510" },
      { label: "Soroban share", value: "48%" },
    ],
    xlm_volume: [
      { label: "XLM volume", value: "8.4M" },
      { label: "Payments", value: "19,400" },
      { label: "Median fee", value: "0.0001" },
    ],
  },
  "30d": {
    ops: [
      { label: "Operations", value: "310,000" },
      { label: "Active wallets", value: "12,040" },
      { label: "Soroban share", value: "46%" },
    ],
    xlm_volume: [
      { label: "XLM volume", value: "29.1M" },
      { label: "Payments", value: "71,200" },
      { label: "Median fee", value: "0.0001" },
    ],
  },
};

export function embedKpis(period: EmbedPeriod, metric: EmbedMetric): EmbedKpi[] {
  return FIXTURE_KPIS[period][metric];
}

/** Stable text snapshot of the KPI strip for visual regression. */
export function embedKpiSnapshot(period: EmbedPeriod, metric: EmbedMetric): string {
  return embedKpis(period, metric)
    .map((kpi) => `${kpi.label}: ${kpi.value}`)
    .join("\n");
}
