/**
 * Claimable-balance create vs claim velocity.
 *
 * `create_claimable_balance` counts as a create. `claim_claimable_balance`
 * counts as a claim. Other operation types (including clawbacks) are ignored
 * rather than inferred. Missing or malformed series soft-fail the whole chart
 * instead of guessing. Net outstanding delta is creates minus claims across
 * the remaining UTC day buckets — not a reconstructed ledger balance.
 */

export type ClaimableClass = "create" | "claim";

export type ClaimableBucket = {
  bucket: string;
  create: number;
  claim: number;
};

export type ClaimableVelocity =
  | { status: "ready"; buckets: ClaimableBucket[]; net: number }
  | { status: "unavailable"; reason: string };

type ClaimableInput = {
  closedAt?: unknown;
  type?: unknown;
  count?: unknown;
};

const UNAVAILABLE =
  "Claimable-balance create and claim subtypes are unavailable.";

/** Classify a single operation type for the create/claim series. */
export function classifyClaimableOperation(
  type: unknown,
): ClaimableClass | "ignore" {
  if (type === "create_claimable_balance") return "create";
  if (type === "claim_claimable_balance") return "claim";
  return "ignore";
}

function utcDay(value: string): string | null {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

export function buildClaimableVelocity(
  rows: unknown,
  range: { start: string; end: string },
): ClaimableVelocity {
  if (!Array.isArray(rows)) {
    return { status: "unavailable", reason: UNAVAILABLE };
  }
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return {
      status: "unavailable",
      reason: "The selected period is not a valid range.",
    };
  }
  const totals = new Map<string, ClaimableBucket>();
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      return { status: "unavailable", reason: UNAVAILABLE };
    }
    const row = item as ClaimableInput;
    const kind = classifyClaimableOperation(row.type);
    if (kind === "ignore") continue;
    if (typeof row.closedAt !== "string") {
      return { status: "unavailable", reason: UNAVAILABLE };
    }
    const closed = Date.parse(row.closedAt);
    if (Number.isNaN(closed) || closed < start || closed >= end) continue;
    const bucket = utcDay(row.closedAt);
    if (!bucket) {
      return { status: "unavailable", reason: UNAVAILABLE };
    }
    const count = row.count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
      return { status: "unavailable", reason: UNAVAILABLE };
    }
    const current = totals.get(bucket) ?? { bucket, create: 0, claim: 0 };
    current[kind] += count;
    totals.set(bucket, current);
  }
  const buckets = [...totals.values()].sort((a, b) =>
    a.bucket.localeCompare(b.bucket),
  );
  const net = buckets.reduce(
    (sum, bucket) => sum + bucket.create - bucket.claim,
    0,
  );
  return { status: "ready", buckets, net };
}

/** True when the series is ready but every create/claim count is zero. */
export function isClaimableVelocityEmpty(result: ClaimableVelocity): boolean {
  if (result.status !== "ready") return false;
  if (result.buckets.length === 0) return true;
  return result.buckets.every(
    (bucket) => bucket.create === 0 && bucket.claim === 0,
  );
}
