/**
 * change_trust with a positive limit opens or raises a trustline.
 * A limit of zero removes it. Without the limit, the two cannot be told
 * apart, and the series is unavailable rather than guessed.
 */

export type TrustlineClass = "create" | "remove";

export type TrustlineBucket = {
  bucket: string;
  create: number;
  remove: number;
};

export type TrustlineVelocity =
  | { status: "ready"; buckets: TrustlineBucket[]; net: number }
  | { status: "unavailable"; reason: string };

type TrustlineInput = {
  closedAt?: unknown;
  type?: unknown;
  limit?: unknown;
  count?: unknown;
};

function classify(type: unknown, limit: unknown): TrustlineClass | "ignore" | "unavailable" {
  if (type !== "change_trust") return "ignore";
  if (limit === undefined || limit === null || limit === "") return "unavailable";
  const value = typeof limit === "number" ? limit : Number(limit);
  if (!Number.isFinite(value) || value < 0) return "unavailable";
  return value === 0 ? "remove" : "create";
}

function utcDay(value: string): string | null {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

export function buildTrustlineVelocity(
  rows: unknown,
  range: { start: string; end: string },
): TrustlineVelocity {
  if (!Array.isArray(rows)) {
    return { status: "unavailable", reason: "Trustline operation subtypes are unavailable." };
  }
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { status: "unavailable", reason: "The selected period is not a valid range." };
  }
  const totals = new Map<string, TrustlineBucket>();
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      return { status: "unavailable", reason: "Trustline operation subtypes are unavailable." };
    }
    const row = item as TrustlineInput;
    const kind = classify(row.type, row.limit);
    if (kind === "unavailable") {
      return { status: "unavailable", reason: "Trustline operation subtypes are unavailable." };
    }
    if (kind === "ignore") continue;
    if (typeof row.closedAt !== "string") {
      return { status: "unavailable", reason: "Trustline operation subtypes are unavailable." };
    }
    const closed = Date.parse(row.closedAt);
    if (Number.isNaN(closed) || closed < start || closed >= end) continue;
    const bucket = utcDay(row.closedAt);
    if (!bucket) {
      return { status: "unavailable", reason: "Trustline operation subtypes are unavailable." };
    }
    const count = row.count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
      return { status: "unavailable", reason: "Trustline operation subtypes are unavailable." };
    }
    const current = totals.get(bucket) ?? { bucket, create: 0, remove: 0 };
    current[kind] += count;
    totals.set(bucket, current);
  }
  const buckets = [...totals.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
  const net = buckets.reduce((sum, bucket) => sum + bucket.create - bucket.remove, 0);
  return { status: "ready", buckets, net };
}
