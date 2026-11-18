import { buildTimeseries } from "@/lib/hubble/activity";
import { resolvePeriod } from "@/lib/periods";
import type { ActivityTimeseries, Period } from "@/lib/types";
import { FIXTURE_PERIOD_MULTIPLIERS } from "@/lib/fixtures/raw-data";
import { getFixtureTimeseriesRawRows } from "@/lib/fixtures/timeseries-raw";
export { getFixtureTimeseriesRawRows } from "@/lib/fixtures/timeseries-raw";

/** Helper to get fixture multiplier for any period including custom ranges */
function getFixtureMultiplier(period: Period): number {
  if (period.startsWith("custom:")) {
    const match = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(period);
    if (match) {
      const [, startStr, endStr] = match;
      const start = new Date(`${startStr}T00:00:00.000Z`);
      const end = new Date(`${endStr}T23:59:59.999Z`);
      const spanDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
      return Math.max(1, spanDays);
    }
    return FIXTURE_PERIOD_MULTIPLIERS["1d"];
  }
  return FIXTURE_PERIOD_MULTIPLIERS[period as Exclude<Period, `custom:${string}:${string}`>];
}

export function getFixtureTimeseries(period: Period, now = new Date()): ActivityTimeseries {
  const range = resolvePeriod(period, now);
  const rawRows = getFixtureTimeseriesRawRows(period, range.start, range.end);
  return buildTimeseries(period, range.start, range.end, rawRows, now);
}

/** Deterministic active wallet counts for fixture KPI wiring. */
export function getFixtureActiveWalletCount(period: Period): number {
  return 12_500 * getFixtureMultiplier(period);
}

export function getFixtureActiveDestinationCount(period: Period): number {
  return 9_800 * getFixtureMultiplier(period);
}
