const CHART_ID = /^[a-z][a-z0-9-]*$/;

export function buildChartDeepLink(currentHref: string, chartId: string): string {
  if (!CHART_ID.test(chartId)) {
    throw new Error("Chart deep-link IDs must be lowercase kebab-case");
  }
  const url = new URL(currentHref);
  url.hash = chartId;
  return url.toString();
}

export function chartIdFromHash(hash: string): string | null {
  const value = decodeURIComponent(hash.replace(/^#/, ""));
  return CHART_ID.test(value) ? value : null;
}

