/**
 * Horizon is a degraded read path, not a second Hubble.
 *
 * The flag defaults off. Production stays on Hubble until the fallback has
 * been validated. When the flag is on and BigQuery is not healthy, the only
 * number shown is the Horizon estimate. Hubble figures are not copied into
 * that tile, and Horizon figures are not copied into the Hubble tiles.
 */

export function isHorizonFallbackEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = env.LUMENMAP_HORIZON_FALLBACK?.trim().toLowerCase();
  return value === "1" || value === "true";
}

/** Test and local fixture. The route does not call Horizon over the network. */
export function readHorizonMock(env: NodeJS.ProcessEnv = process.env): unknown {
  const raw = env.LUMENMAP_HORIZON_MOCK;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Sum of operation_count on a Horizon ledgers payload.
 * Any malformed record rejects the whole sample. A partial sum would look
 * like a real estimate of a window Horizon did not actually return.
 */
export function estimateRecentOperations(sample: unknown): number | null {
  if (!sample || typeof sample !== "object") return null;
  const records = (sample as { _embedded?: { records?: unknown } })._embedded?.records;
  if (!Array.isArray(records) || records.length === 0) return null;
  let total = 0;
  for (const record of records) {
    if (!record || typeof record !== "object") return null;
    const count = (record as { operation_count?: unknown }).operation_count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
    total += count;
  }
  return total;
}

export type HorizonFallbackReport = {
  active: boolean;
  source: "horizon" | "none";
  operationCount: number | null;
};

export function buildHorizonFallbackReport(input: {
  flagEnabled: boolean;
  hubbleStatus: "ok" | "degraded" | "unavailable";
  horizonSample: unknown;
}): HorizonFallbackReport {
  const useHorizon = input.flagEnabled && input.hubbleStatus !== "ok";
  if (!useHorizon) {
    return { active: false, source: "none", operationCount: null };
  }
  return {
    active: true,
    source: "horizon",
    operationCount: estimateRecentOperations(input.horizonSample),
  };
}
