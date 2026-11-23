/**
 * Invoke success is shown only when both counts are present and usable.
 * A missing column is unavailable. It is not treated as zero, because zero
 * would invent a 0% or 100% rate for a schema that did not answer.
 */

export type InvokeSuccess =
  | { status: "ready"; success: number; failure: number; rate: number }
  | { status: "unavailable"; reason: string };

export function mapInvokeSuccess(row: unknown): InvokeSuccess {
  if (row === null || row === undefined || typeof row !== "object") {
    return { status: "unavailable", reason: "Invoke success rate is unavailable for this period." };
  }
  const record = row as Record<string, unknown>;
  if (!("successfulInvokes" in record) || !("failedInvokes" in record)) {
    return { status: "unavailable", reason: "Invoke success rate is unavailable for this period." };
  }
  const success = record.successfulInvokes;
  const failure = record.failedInvokes;
  if (success === null || failure === null) {
    return { status: "unavailable", reason: "Invoke success rate is unavailable for this period." };
  }
  if (
    typeof success !== "number" ||
    typeof failure !== "number" ||
    !Number.isFinite(success) ||
    !Number.isFinite(failure) ||
    !Number.isInteger(success) ||
    !Number.isInteger(failure) ||
    success < 0 ||
    failure < 0
  ) {
    return { status: "unavailable", reason: "Invoke success counts are malformed." };
  }
  const total = success + failure;
  if (total === 0) {
    return { status: "unavailable", reason: "No invokes were recorded for this contract." };
  }
  return { status: "ready", success, failure, rate: success / total };
}
