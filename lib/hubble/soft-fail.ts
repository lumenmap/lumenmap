import { classifyError, endTimer, logWarn, startTimer } from "@/lib/log";
import type { ErrorClass } from "@/lib/log";
import { metrics } from "@/lib/telemetry/metrics";

/**
 * Soft-fail strategy for *optional* Hubble/BigQuery subqueries.
 *
 * Required queries must still reject the whole activity request, but optional
 * enrichments (USDC breakdowns, transaction categories, account metadata, ...)
 * should degrade gracefully: when one times out, drifts from the expected
 * schema, or exceeds the bytes-billed budget, the public activity payload must
 * still resolve with the KPIs it could compute.
 *
 * `runOptionalQuery` centralises that behaviour so each optional query gets the
 * same typed fallback, structured log entry, and per-query telemetry counter.
 */

/** Value recorded in the `query_outcome` counter dimension on a soft failure. */
export const SOFT_FAIL_OUTCOME = "soft_fail";

/** Counter dimension that separates soft failures from other query outcomes. */
export const QUERY_OUTCOME_DIMENSION = "query_outcome";

/** Counter dimension identifying which optional query failed. */
export const QUERY_NAME_DIMENSION = "query_name";

/** Counter dimension carrying the classified failure reason. */
export const ERROR_CLASS_DIMENSION = "error_class";

export interface SoftFailureInput {
  /** Stable query identifier, e.g. `usdcCategory`. */
  queryName: string;
  /** Classified cause returned by {@link classifyError}. */
  errorClass: ErrorClass;
}

/**
 * Records one soft failure by query name and error class. The counter is
 * namespaced under the `activity` endpoint so it can be surfaced alongside the
 * existing cache metrics.
 */
export function recordSoftFailure({
  queryName,
  errorClass,
}: SoftFailureInput): void {
  metrics.increment({
    endpoint: "activity",
    [QUERY_OUTCOME_DIMENSION]: SOFT_FAIL_OUTCOME,
    [QUERY_NAME_DIMENSION]: queryName,
    [ERROR_CLASS_DIMENSION]: errorClass,
  });
}

/** Reads the soft-failure counter for a given query name and error class. */
export function readSoftFailureCount(
  queryName: string,
  errorClass: ErrorClass,
): number {
  return metrics.readCounter({
    endpoint: "activity",
    [QUERY_OUTCOME_DIMENSION]: SOFT_FAIL_OUTCOME,
    [QUERY_NAME_DIMENSION]: queryName,
    [ERROR_CLASS_DIMENSION]: errorClass,
  });
}

/**
 * Runs an optional query and returns a typed fallback instead of throwing when
 * it fails.
 *
 * @param queryName    Stable identifier used for logs and telemetry.
 * @param execute      Thunk that performs the optional query (usually `runQuery`).
 * @param fallback     Factory for the value returned on failure. A factory is
 *                     used so callers returning arrays never share a mutable
 *                     instance between requests.
 * @param correlationId Request correlation id forwarded to the log entry.
 */
export async function runOptionalQuery<T>(
  queryName: string,
  execute: () => Promise<T>,
  fallback: () => T,
  correlationId: string,
): Promise<T> {
  const timer = startTimer();

  try {
    return await execute();
  } catch (error) {
    const errorClass = classifyError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    logWarn({
      event: "activity.query.soft_fail",
      correlationId,
      queryName,
      durationMs: endTimer(timer),
      errorClass,
      errorMessage,
    });

    recordSoftFailure({ queryName, errorClass });

    return fallback();
  }
}
