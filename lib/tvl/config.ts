/**
 * Reads which protocols should use a live (non-fixture) TVL adapter.
 *
 * Environment Variable: `LUMENMAP_TVL_LIVE_ADAPTERS`
 * - Format: comma-separated protocol ids (case-insensitive, whitespace ignored)
 *   e.g. "soroswap,circle"
 * - Default: "" (empty) — every protocol uses its fixture adapter, matching
 *   the pre-existing fixture-only behaviour exactly.
 * - A protocol id here only takes effect if a live adapter factory is
 *   registered for it in `lib/tvl/protocol-registry.ts`. An id with no
 *   matching factory is ignored (the protocol keeps using its fixture).
 *
 * This is intentionally opt-in and additive: unset, the registry behaves
 * exactly as it did before live adapters existed.
 */
export function getEnabledLiveAdapterIds(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const raw = env.LUMENMAP_TVL_LIVE_ADAPTERS;
  if (!raw) return new Set();

  return new Set(
    raw
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter((id) => id.length > 0),
  );
}
