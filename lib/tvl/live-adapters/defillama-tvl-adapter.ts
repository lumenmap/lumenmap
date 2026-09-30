import type { ProtocolTvlAdapter, TvlAdapterResult } from "@/lib/tvl/adapter";

/**
 * Live TVL adapter backed by DefiLlama's free, no-auth public API
 * (`https://api.llama.fi`). This is a pragmatic, externally-sourced adapter:
 * it reports the USD figure DefiLlama already computes for a protocol, it
 * does not read Stellar ledger/Hubble state itself, and it does not follow
 * the Hubble-native snapshot/pricing/double-counting rules in
 * `docs/tvl-methodology.md` (that document is explicitly about a
 * Hubble-derived adapter and is tracked separately — see its §11 and this
 * issue's "Out of scope"). It exists to demonstrate the adapter registry
 * loading a real, non-fixture module, per issue #253's acceptance criteria.
 *
 * A future Hubble-native adapter that satisfies `docs/tvl-methodology.md`
 * can replace this one for a given protocol without any change to the
 * registry, the treemap builder, or the `ProtocolTvlAdapter` contract.
 */

const DEFAULT_BASE_URL = "https://api.llama.fi";
const DEFAULT_TIMEOUT_MS = 5000;

export interface DefiLlamaTvlAdapterOptions {
  /** Base URL for the DefiLlama API. Overridable for tests. */
  baseUrl?: string;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** Injectable fetch implementation, for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * DefiLlama's `GET /tvl/{protocol}` returns either a bare JSON number, or
 * (for some protocol slugs) an object with a `tvl` field. Handle both
 * defensively rather than assuming one shape.
 */
function extractTvlUsd(payload: unknown): number | null {
  if (isFiniteNumber(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    "tvl" in payload &&
    isFiniteNumber((payload as { tvl: unknown }).tvl)
  ) {
    return (payload as { tvl: number }).tvl;
  }
  return null;
}

export class DefiLlamaTvlAdapter implements ProtocolTvlAdapter {
  private readonly protocolName: string;
  private readonly slug: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  /**
   * @param protocolName Display name used in the treemap tile, e.g. "Soroswap".
   * @param slug DefiLlama's protocol slug, e.g. "soroswap"
   *   (see https://api.llama.fi/protocols for the full list).
   */
  constructor(
    protocolName: string,
    slug: string,
    options: DefiLlamaTvlAdapterOptions = {},
  ) {
    this.protocolName = protocolName;
    this.slug = slug;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getTvl(): Promise<TvlAdapterResult> {
    const snapshotTime = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/tvl/${encodeURIComponent(this.slug)}`,
        { signal: controller.signal },
      );

      if (!response.ok) {
        return this.failed(
          snapshotTime,
          `DefiLlama returned HTTP ${response.status} for slug "${this.slug}"`,
        );
      }

      const payload: unknown = await response.json();
      const tvlUsd = extractTvlUsd(payload);

      if (tvlUsd === null) {
        return this.failed(
          snapshotTime,
          `DefiLlama response for "${this.slug}" did not contain a numeric TVL`,
        );
      }

      return {
        protocol: this.protocolName,
        network: "stellar",
        status: "complete",
        methodologyVersion: "defillama-external-v1",
        snapshotTime,
        positions: [
          {
            canonicalAsset: "USD",
            nativeAmount: String(tvlUsd),
            usdValue: String(tvlUsd),
            priceProvenance: {
              source: "defillama",
              timestamp: snapshotTime,
            },
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `DefiLlama request for "${this.slug}" timed out after ${this.timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error);
      return this.failed(snapshotTime, message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private failed(snapshotTime: string, error: string): TvlAdapterResult {
    return {
      protocol: this.protocolName,
      network: "stellar",
      status: "failed",
      snapshotTime,
      error,
    };
  }
}
