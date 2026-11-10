import type { Period } from "@/lib/types";

export interface TrustlineVelocityBucket {
  bucketUtc: string;
  createdCount: number;
  removedCount: number;
  netChange: number;
}

export interface TrustlineVelocitySummary {
  status: "available" | "unavailable";
  source: "hubble" | "fixture";
  period: Period;
  totalCreated: number;
  totalRemoved: number;
  netTrustlineChange: number;
  buckets: TrustlineVelocityBucket[];
  reason?: "subtype_unavailable" | "query_failed";
  message?: string;
  methodologyHref: "/methodology#operation-categories";
}

/**
 * Classify a `change_trust` operation into `"create"` (positive trust limit)
 * or `"remove"` (`limit === 0`, which deletes a trustline on Stellar).
 * Returns `null` for non-trustline operation types or unparseable limits.
 */
export function classifyChangeTrustAction(input: {
  type_string?: string | null;
  limit?: string | number | null;
}): "create" | "remove" | null {
  if (
    input.type_string != null &&
    input.type_string.trim() !== "" &&
    input.type_string.trim() !== "change_trust"
  ) {
    return null;
  }

  if (input.limit === undefined || input.limit === null) {
    return null;
  }

  const numericLimit =
    typeof input.limit === "number"
      ? input.limit
      : Number(String(input.limit).trim());

  if (!Number.isFinite(numericLimit) || numericLimit < 0) {
    return null;
  }

  return numericLimit === 0 ? "remove" : "create";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNonNegativeInt(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

export function mapTrustlineVelocityBuckets(input: {
  period: Period;
  source?: "hubble" | "fixture";
  rows: unknown;
  subtypeAvailable?: boolean;
}): TrustlineVelocitySummary {
  if (input.subtypeAvailable === false) {
    return {
      status: "unavailable",
      source: input.source ?? "hubble",
      period: input.period,
      totalCreated: 0,
      totalRemoved: 0,
      netTrustlineChange: 0,
      buckets: [],
      reason: "subtype_unavailable",
      message:
        "Trustline create/remove limit subtypes are not available in the current feed; generic change_trust totals remain in the treemap.",
      methodologyHref: "/methodology#operation-categories",
    };
  }

  const rawRows = Array.isArray(input.rows) ? input.rows : [];
  const bucketMap = new Map<
    string,
    { createdCount: number; removedCount: number }
  >();
  let sawValidSubtype = false;

  for (const item of rawRows) {
    const row = asRecord(item);
    if (!row) continue;
    const bucketUtc =
      typeof row.bucket_utc === "string" ? row.bucket_utc.trim() : "";
    if (!bucketUtc) continue;

    const explicitCreated = toNonNegativeInt(row.created_count);
    const explicitRemoved = toNonNegativeInt(row.removed_count);

    if (explicitCreated !== null || explicitRemoved !== null) {
      sawValidSubtype = true;
      const entry = bucketMap.get(bucketUtc) ?? {
        createdCount: 0,
        removedCount: 0,
      };
      entry.createdCount += explicitCreated ?? 0;
      entry.removedCount += explicitRemoved ?? 0;
      bucketMap.set(bucketUtc, entry);
      continue;
    }

    const action = classifyChangeTrustAction({
      type_string:
        typeof row.type_string === "string" ? row.type_string : "change_trust",
      limit: row.limit as string | number | null | undefined,
    });
    if (action) {
      sawValidSubtype = true;
      const opCount = toNonNegativeInt(row.op_count) ?? 1;
      const entry = bucketMap.get(bucketUtc) ?? {
        createdCount: 0,
        removedCount: 0,
      };
      if (action === "create") {
        entry.createdCount += opCount;
      } else {
        entry.removedCount += opCount;
      }
      bucketMap.set(bucketUtc, entry);
    }
  }

  if (!sawValidSubtype) {
    return {
      status: "unavailable",
      source: input.source ?? "hubble",
      period: input.period,
      totalCreated: 0,
      totalRemoved: 0,
      netTrustlineChange: 0,
      buckets: [],
      reason: "subtype_unavailable",
      message:
        "Trustline create/remove limit subtypes are not available in the current feed; generic change_trust totals remain in the treemap.",
      methodologyHref: "/methodology#operation-categories",
    };
  }

  const buckets: TrustlineVelocityBucket[] = [...bucketMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketUtc, counts]) => ({
      bucketUtc,
      createdCount: counts.createdCount,
      removedCount: counts.removedCount,
      netChange: counts.createdCount - counts.removedCount,
    }));

  const totalCreated = buckets.reduce((sum, b) => sum + b.createdCount, 0);
  const totalRemoved = buckets.reduce((sum, b) => sum + b.removedCount, 0);

  return {
    status: "available",
    source: input.source ?? "hubble",
    period: input.period,
    totalCreated,
    totalRemoved,
    netTrustlineChange: totalCreated - totalRemoved,
    buckets,
    methodologyHref: "/methodology#operation-categories",
  };
}

export function buildTrustlineVelocityFixture(
  period: Period,
): TrustlineVelocitySummary {
  const rows = [
    {
      bucket_utc: "2026-01-01T00:00:00Z",
      created_count: 1420,
      removed_count: 380,
    },
    {
      bucket_utc: "2026-01-01T06:00:00Z",
      created_count: 1890,
      removed_count: 510,
    },
    {
      bucket_utc: "2026-01-01T12:00:00Z",
      created_count: 2340,
      removed_count: 920,
    },
    {
      bucket_utc: "2026-01-01T18:00:00Z",
      created_count: 1650,
      removed_count: 490,
    },
  ];

  return mapTrustlineVelocityBuckets({
    period,
    source: "fixture",
    rows,
    subtypeAvailable: true,
  });
}
