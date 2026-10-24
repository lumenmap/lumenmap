import { getBigQueryClient, hasBigQueryCredentials } from "@/lib/hubble/client";
import { getCached, setCache } from "@/lib/hubble/cache";
import { isRollupEnabled } from "@/lib/hubble/rollups-config";
import { rollupDailyTimeseriesQuery } from "@/lib/hubble/rollup-queries";
import { buildTimeseries } from "@/lib/hubble/activity";
import {
  dailyTimeseriesQuery,
  hourlyTimeseriesQuery,
  mapTimeseriesRows,
} from "@/lib/hubble/queries";
import {
  getFixtureTimeseries,
  getFixtureTimeseriesRawRows,
} from "@/lib/fixtures/timeseries";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import { resolvePeriod } from "@/lib/periods";
import type {
  ActivityMetricProvenance,
  ActivityTimeseries,
  DataSource,
  Period,
} from "@/lib/types";

export type TimeseriesGranularity = "hour" | "day";

export interface SparklineSeries {
  values: number[];
  lastValue: number;
}

export interface SparklineData {
  totalOperations: SparklineSeries;
  sorobanShare: SparklineSeries;
}

export interface TimeseriesResponse extends ActivityTimeseries {
  period: Period;
  start: string;
  end: string;
  source: DataSource;
  sourceTimestamp: string;
  isPeriodComplete: boolean;
  metricProvenance: ActivityMetricProvenance;
  fixture?: boolean;
  sparkline?: SparklineData;
}

function defaultGranularity(period: Period): TimeseriesGranularity {
  return period === "1d" ? "hour" : "day";
}

function buildSparklineData(
  timeseries: ActivityTimeseries,
): SparklineData | undefined {
  const totalOperations: number[] = [];
  const sorobanShare: number[] = [];

  for (const bucket of timeseries.buckets ?? []) {
    const typedBucket = bucket as {
      totalOperations?: number;
      operations?: number;
      sorobanOperations?: number;
      soroban?: number;
    };
    const ops = Number(
      typedBucket.totalOperations ?? typedBucket.operations ?? 0,
    );
    const soroban = Number(
      typedBucket.sorobanOperations ?? typedBucket.soroban ?? 0,
    );
    totalOperations.push(ops);
    sorobanShare.push(ops > 0 ? (soroban / ops) * 100 : 0);
  }

  if (totalOperations.length === 0) {
    return undefined;
  }

  const toSeries = (values: number[]): SparklineSeries => {
    return {
      values,
      lastValue: values.length > 0 ? (values[values.length - 1] ?? 0) : 0,
    };
  };

  return {
    totalOperations: toSeries(totalOperations),
    sorobanShare: toSeries(sorobanShare),
  };
}

async function fetchTimeseriesRows(
  start: string,
  end: string,
  granularity: TimeseriesGranularity,
): Promise<ReturnType<typeof mapTimeseriesRows>> {
  const client = getBigQueryClient();
  if (!client) {
    throw new Error("BigQuery client is not configured");
  }

  const query =
    granularity === "hour"
      ? hourlyTimeseriesQuery
      : (isRollupEnabled() ? rollupDailyTimeseriesQuery() : dailyTimeseriesQuery);

  const [rows] = await client.query({
    query,
    params: { start, end },
  });

  return mapTimeseriesRows(rows as Record<string, unknown>[]);
}

export async function getTimeseriesData(
  period: Period,
  granularityParam?: TimeseriesGranularity | null,
  now = new Date(),
): Promise<TimeseriesResponse> {
  const range = resolvePeriod(period, now);
  const granularity = granularityParam ?? defaultGranularity(period);
  const start = range.start.toISOString();
  const end = range.end.toISOString();
  const isPeriodComplete = range.end.getTime() <= now.getTime();

  if (!hasBigQueryCredentials()) {
    const rawRows = getFixtureTimeseriesRawRows(period, range.start, range.end);
    const timeseries = buildTimeseries(
      period,
      range.start,
      range.end,
      rawRows,
      now,
      granularity,
    );

    return {
      period,
      start,
      end,
      source: "fixture",
      sourceTimestamp: end,
      isPeriodComplete: true,
      ...timeseries,
      metricProvenance: buildActivityMetricProvenance(),
      fixture: true,
      sparkline: buildSparklineData(timeseries),
    };
  }

  const cacheKey = `timeseries:v1:${period}:${granularity}:${range.start.toISOString()}`;
  const cached = getCached<TimeseriesResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const rawRows = await fetchTimeseriesRows(start, end, granularity);
  const timeseries = buildTimeseries(
    period,
    range.start,
    range.end,
    rawRows,
    now,
    granularity,
  );

  const response: TimeseriesResponse = {
    period,
    start,
    end,
    source: "hubble",
    sourceTimestamp: now.toISOString(),
    isPeriodComplete,
    ...timeseries,
    metricProvenance: buildActivityMetricProvenance(),
    sparkline: buildSparklineData(timeseries),
  };

  setCache(cacheKey, response);
  return response;
}

export function getFixtureTimeseriesResponse(
  period: Period,
): TimeseriesResponse {
  const data = getFixtureTimeseries(period);
  const range = resolvePeriod(period);

  return {
    period,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    source: "fixture",
    sourceTimestamp: range.end.toISOString(),
    isPeriodComplete: true,
    ...data,
    metricProvenance: buildActivityMetricProvenance(),
    fixture: true,
    sparkline: buildSparklineData(data),
  };
}
