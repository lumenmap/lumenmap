import {
  CATEGORY_COLORS,
  GROUP_LABELS,
  TYPE_TO_GROUP,
} from "@/lib/constants";
import type { Period } from "@/lib/types";

export const CATEGORY_IDS = [
  "soroban",
  "payments",
  "dex",
  "liquidity_pools",
  "claimable_balances",
  "trustlines",
  "account",
  "other",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type CategoryShareGranularity = "hour" | "day";

export type CategoryShareMode = "absolute" | "percentage";

/** Raw Hubble (or fixture) rows before category mapping. */
export interface CategoryShareRawRow {
  bucket_start: string;
  type_string: string;
  op_count: number;
}

export interface CategoryShareLegendItem {
  id: CategoryId;
  label: string;
  color: string;
}

export interface CategoryShareBucket {
  bucketStart: string;
  bucketEnd: string;
  /** True when the UTC bucket has not fully elapsed yet. */
  partial: boolean;
  total: number;
  categories: Record<CategoryId, number>;
}

export interface CategoryShareSeries {
  period: Period;
  granularity: CategoryShareGranularity;
  timezone: "UTC";
  start: string;
  end: string;
  buckets: CategoryShareBucket[];
  legend: CategoryShareLegendItem[];
}

export function mapTypeToCategory(typeString: string): CategoryId {
  const group = TYPE_TO_GROUP[typeString];
  if (group && (CATEGORY_IDS as readonly string[]).includes(group)) {
    return group as CategoryId;
  }
  return "other";
}

export function emptyCategoryCounts(): Record<CategoryId, number> {
  return {
    soroban: 0,
    payments: 0,
    dex: 0,
    liquidity_pools: 0,
    claimable_balances: 0,
    trustlines: 0,
    account: 0,
    other: 0,
  };
}

export function buildCategoryLegend(): CategoryShareLegendItem[] {
  return CATEGORY_IDS.map((id) => ({
    id,
    label: GROUP_LABELS[id] ?? id,
    color: CATEGORY_COLORS[id] ?? CATEGORY_COLORS.other,
  }));
}

export function resolveCategoryShareGranularity(
  period: Period,
): CategoryShareGranularity {
  return period === "1d" ? "hour" : "day";
}

export function truncateToUtcBucket(
  date: Date,
  granularity: CategoryShareGranularity,
): Date {
  if (granularity === "hour") {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
      ),
    );
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcBucket(
  date: Date,
  granularity: CategoryShareGranularity,
): Date {
  const next = new Date(date.getTime());
  if (granularity === "hour") {
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  }
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function bucketEndExclusive(
  bucketStart: Date,
  granularity: CategoryShareGranularity,
): Date {
  return addUtcBucket(bucketStart, granularity);
}

/**
 * Builds a complete UTC bucket series for the period.
 * Unknown operation types map to Other. Empty buckets are retained.
 * The current incomplete bucket is marked partial.
 */
export function buildCategoryShareSeries(input: {
  period: Period;
  start: Date;
  end: Date;
  rows: CategoryShareRawRow[];
  now?: Date;
}): CategoryShareSeries {
  const now = input.now ?? new Date();
  const granularity = resolveCategoryShareGranularity(input.period);
  const rangeStart = truncateToUtcBucket(input.start, granularity);
  const lastBucketStart = truncateToUtcBucket(
    new Date(Math.min(input.end.getTime(), now.getTime())),
    granularity,
  );

  const totalsByBucket = new Map<string, Record<CategoryId, number>>();

  for (const row of input.rows) {
    const parsed = new Date(row.bucket_start);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    const key = truncateToUtcBucket(parsed, granularity).toISOString();
    const counts = totalsByBucket.get(key) ?? emptyCategoryCounts();
    const category = mapTypeToCategory(row.type_string);
    counts[category] += Number(row.op_count) || 0;
    totalsByBucket.set(key, counts);
  }

  const buckets: CategoryShareBucket[] = [];
  for (
    let cursor = rangeStart;
    cursor.getTime() <= lastBucketStart.getTime();
    cursor = addUtcBucket(cursor, granularity)
  ) {
    const key = cursor.toISOString();
    const categories = totalsByBucket.get(key) ?? emptyCategoryCounts();
    const total = CATEGORY_IDS.reduce((sum, id) => sum + categories[id], 0);
    const end = bucketEndExclusive(cursor, granularity);
    const partial = end.getTime() > now.getTime();

    buckets.push({
      bucketStart: key,
      bucketEnd: end.toISOString(),
      partial,
      total,
      categories: { ...categories },
    });
  }

  return {
    period: input.period,
    granularity,
    timezone: "UTC",
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    buckets,
    legend: buildCategoryLegend(),
  };
}

/**
 * Converts absolute category counts to percentage shares.
 * Non-empty buckets sum to 100 (within floating-point fix via remainder on Other).
 * Empty buckets remain all zeros.
 */
export function toPercentageCategories(
  categories: Record<CategoryId, number>,
  total: number,
): Record<CategoryId, number> {
  if (total <= 0) {
    return emptyCategoryCounts();
  }

  const result = emptyCategoryCounts();
  let assigned = 0;

  for (let index = 0; index < CATEGORY_IDS.length; index += 1) {
    const id = CATEGORY_IDS[index];
    if (index === CATEGORY_IDS.length - 1) {
      result[id] = Math.max(0, 100 - assigned);
      break;
    }
    const pct = (categories[id] / total) * 100;
    result[id] = pct;
    assigned += pct;
  }

  return result;
}

export function assertBucketReconciles(bucket: CategoryShareBucket): boolean {
  const categorySum = CATEGORY_IDS.reduce(
    (sum, id) => sum + bucket.categories[id],
    0,
  );
  return categorySum === bucket.total;
}

export function assertPercentageSumsTo100(
  categories: Record<CategoryId, number>,
  total: number,
  epsilon = 1e-9,
): boolean {
  if (total <= 0) {
    return CATEGORY_IDS.every((id) => categories[id] === 0);
  }
  const sum = CATEGORY_IDS.reduce((acc, id) => acc + categories[id], 0);
  return Math.abs(sum - 100) <= epsilon;
}
