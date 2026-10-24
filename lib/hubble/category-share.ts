import { getBigQueryClient, hasBigQueryCredentials } from "@/lib/hubble/client";
import { getCached, setCache } from "@/lib/hubble/cache";
import { isRollupEnabled } from "@/lib/hubble/rollups-config";
import { rollupCategoryShareQuery } from "@/lib/hubble/rollup-queries";
import {
  buildCategoryShareSeries,
  type CategoryShareRawRow,
  type CategoryShareSeries,
} from "@/lib/charts/category-share";
import { getFixtureCategoryShareSeries } from "@/lib/charts/category-share-fixture";
import { resolvePeriod } from "@/lib/periods";
import type { Period } from "@/lib/types";

export type CategoryShareDataSource = "hubble" | "fixture";

export interface CategoryShareResponse extends CategoryShareSeries {
  source: CategoryShareDataSource;
}

export function categoryShareQuery(granularity: "hour" | "day"): string {
  const trunc = granularity === "hour" ? "HOUR" : "DAY";
  return `
SELECT
  TIMESTAMP_TRUNC(closed_at, ${trunc}) AS bucket_start,
  type_string,
  COUNT(*) AS op_count
FROM \`crypto-stellar.crypto_stellar_dbt.enriched_history_operations\`
WHERE closed_at BETWEEN @start AND @end
GROUP BY bucket_start, type_string
ORDER BY bucket_start, type_string
`;
}

export function mapCategoryShareRows(
  rows: Record<string, unknown>[],
): CategoryShareRawRow[] {
  return rows.map((row) => {
    const bucket = row.bucket_start;
    const bucketStart =
      bucket instanceof Date
        ? bucket.toISOString()
        : typeof bucket === "object" &&
            bucket !== null &&
            "value" in bucket &&
            typeof (bucket as { value: unknown }).value === "string"
          ? (bucket as { value: string }).value
          : String(bucket);

    return {
      bucket_start: bucketStart,
      type_string: String(row.type_string),
      op_count: Number(row.op_count) || 0,
    };
  });
}

async function fetchCategoryShareRows(
  start: string,
  end: string,
  granularity: "hour" | "day",
): Promise<CategoryShareRawRow[]> {
  const client = getBigQueryClient();
  if (!client) {
    throw new Error("BigQuery client is not configured");
  }

  const query = isRollupEnabled()
    ? rollupCategoryShareQuery(granularity)
    : categoryShareQuery(granularity);

  const [rows] = await client.query({
    query,
    params: { start, end },
  });

  return mapCategoryShareRows(rows as Record<string, unknown>[]);
}

export async function getCategoryShareData(
  period: Period,
): Promise<CategoryShareResponse> {
  if (!hasBigQueryCredentials()) {
    const series = getFixtureCategoryShareSeries(period);
    return { ...series, source: "fixture" };
  }

  const range = resolvePeriod(period);
  const cacheKey = `category-share:v1:${period}:${range.start.toISOString()}`;
  const cached = getCached<CategoryShareResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const granularity = period === "1d" ? "hour" : "day";
  const rows = await fetchCategoryShareRows(
    range.start.toISOString(),
    range.end.toISOString(),
    granularity,
  );

  const series = buildCategoryShareSeries({
    period,
    start: range.start,
    end: range.end,
    rows,
  });

  const response: CategoryShareResponse = {
    ...series,
    source: "hubble",
  };

  setCache(cacheKey, response);
  return response;
}
