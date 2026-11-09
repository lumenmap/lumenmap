import type { Period } from "@/lib/types";

export type TrustlineActionKind = "create" | "remove" | "other";

export interface RawTrustlineVelocityRow {
  bucket_utc?: unknown;
  type_string?: unknown;
  trustline_limit?: unknown;
  created_count?: unknown;
  removed_count?: unknown;
  op_count?: unknown;
}

export interface TrustlineVelocityBucket {
  timestampUtc: string;
  label: string;
  createdCount: number;
  removedCount: number;
  netChange: number;
}

export interface TrustlineVelocitySeries {
  status: "available" | "unavailable";
  source: "hubble" | "fixture";
  period: Period;
  buckets: TrustlineVelocityBucket[];
  totalCreated: number;
  totalRemoved: number;
  netTrustlineChange: number;
  methodologyHref: string;
}

export function classifyTrustlineOperation(
  typeString: unknown,
  limitValue?: unknown,
): TrustlineActionKind {
  const normalized =
    typeof typeString === "string" ? typeString.trim().toLowerCase() : "";
  if (
    normalized !== "change_trust" &&
    normalized !== "change_trust_op" &&
    normalized !== "trustline_create" &&
    normalized !== "trustline_remove"
  ) {
    return "other";
  }
  if (normalized === "trustline_remove") return "remove";
  if (normalized === "trustline_create") return "create";

  if (limitValue === undefined || limitValue === null || limitValue === "") {
    return "other";
  }
  const numericLimit = Number(limitValue);
  if (!Number.isFinite(numericLimit) || numericLimit < 0) {
    return "other";
  }
  return numericLimit === 0 ? "remove" : "create";
}

function toCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

export function mapTrustlineVelocityRows(
  rows: readonly RawTrustlineVelocityRow[],
  period: Period = "1d",
  source: "hubble" | "fixture" = "hubble",
): TrustlineVelocitySeries {
  const byBucket = new Map<string, { created: number; removed: number }>();
  let anySubtypeFound = false;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const ts =
      typeof row.bucket_utc === "string" && row.bucket_utc.trim()
        ? row.bucket_utc.trim()
        : null;
    if (!ts || !ts.endsWith("Z")) continue;

    const explicitCreated = toCount(row.created_count);
    const explicitRemoved = toCount(row.removed_count);

    if (explicitCreated !== null || explicitRemoved !== null) {
      anySubtypeFound = true;
      const entry = byBucket.get(ts) ?? { created: 0, removed: 0 };
      entry.created += explicitCreated ?? 0;
      entry.removed += explicitRemoved ?? 0;
      byBucket.set(ts, entry);
      continue;
    }

    const kind = classifyTrustlineOperation(
      row.type_string,
      row.trustline_limit,
    );
    const count = toCount(row.op_count);
    if (kind !== "other" && count !== null) {
      anySubtypeFound = true;
      const entry = byBucket.get(ts) ?? { created: 0, removed: 0 };
      if (kind === "create") entry.created += count;
      else entry.removed += count;
      byBucket.set(ts, entry);
    }
  }

  if (!anySubtypeFound || byBucket.size === 0) {
    return {
      status: "unavailable",
      source,
      period,
      buckets: [],
      totalCreated: 0,
      totalRemoved: 0,
      netTrustlineChange: 0,
      methodologyHref: "/methodology#trustline-velocity",
    };
  }

  const sortedTimestamps = Array.from(byBucket.keys()).sort();
  const buckets: TrustlineVelocityBucket[] = [];
  let totalCreated = 0;
  let totalRemoved = 0;

  for (const ts of sortedTimestamps) {
    const counts = byBucket.get(ts)!;
    totalCreated += counts.created;
    totalRemoved += counts.removed;
    buckets.push({
      timestampUtc: ts,
      label: period === "1d" ? ts.slice(11, 16) : ts.slice(0, 10),
      createdCount: counts.created,
      removedCount: counts.removed,
      netChange: counts.created - counts.removed,
    });
  }

  return {
    status: "available",
    source,
    period,
    buckets,
    totalCreated,
    totalRemoved,
    netTrustlineChange: totalCreated - totalRemoved,
    methodologyHref: "/methodology#trustline-velocity",
  };
}

export function getFixtureTrustlineVelocity(
  period: Period = "1d",
): TrustlineVelocitySeries {
  return mapTrustlineVelocityRows(
    [
      {
        bucket_utc: "2026-10-01T00:00:00Z",
        created_count: 1_840,
        removed_count: 420,
      },
      {
        bucket_utc: "2026-10-01T06:00:00Z",
        created_count: 2_310,
        removed_count: 690,
      },
      {
        bucket_utc: "2026-10-01T12:00:00Z",
        created_count: 1_950,
        removed_count: 510,
      },
    ],
    period,
    "fixture",
  );
}
