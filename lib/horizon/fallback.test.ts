import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { handleActivityRequest } from "@/app/api/activity/_handler";
import { GET as healthGET } from "@/app/api/health/route";
import { UpstreamQueryFailedError } from "@/lib/hubble/activity";
import {
  HORIZON_FALLBACK_BANNER_TEXT,
  isHorizonFallbackActive,
  isHorizonFallbackEnabled,
  resetHorizonFallbackState,
  setHorizonFetcherForTests,
} from "./fallback";

describe("Horizon fallback read path when BigQuery is unavailable (#457)", () => {
  const previousFlag = process.env.LUMENMAP_HORIZON_FALLBACK_ENABLED;
  const previousFixture = process.env.LUMENMAP_DATA_SOURCE;

  beforeEach(() => {
    resetHorizonFallbackState();
    delete process.env.LUMENMAP_HORIZON_FALLBACK_ENABLED;
    delete process.env.LUMENMAP_DATA_SOURCE;
  });

  afterEach(() => {
    resetHorizonFallbackState();
    if (previousFlag === undefined) {
      delete process.env.LUMENMAP_HORIZON_FALLBACK_ENABLED;
    } else {
      process.env.LUMENMAP_HORIZON_FALLBACK_ENABLED = previousFlag;
    }
    if (previousFixture === undefined) {
      delete process.env.LUMENMAP_DATA_SOURCE;
    } else {
      process.env.LUMENMAP_DATA_SOURCE = previousFixture;
    }
  });

  it("defaults feature flag off in production unless explicitly enabled", () => {
    assert.equal(isHorizonFallbackEnabled({ NODE_ENV: "production" }), false);
    assert.equal(isHorizonFallbackEnabled({}), false);
    assert.equal(
      isHorizonFallbackEnabled({
        NODE_ENV: "production",
        LUMENMAP_HORIZON_FALLBACK_ENABLED: "true",
      }),
      true,
    );
  });

  it("returns 503 when Hubble fails and Horizon fallback flag is off", async () => {
    const failingFetcher = async () => {
      throw new UpstreamQueryFailedError("Hubble BigQuery unavailable");
    };

    const res = await handleActivityRequest(
      new Request("http://localhost:3000/api/v1/activity?period=1d"),
      failingFetcher,
    );
    assert.equal(res.status, 503);
    assert.equal(isHorizonFallbackActive(), false);
  });

  it("serves degraded Horizon KPI subset with banner and reports active in /api/health when flag is on", async () => {
    process.env.LUMENMAP_HORIZON_FALLBACK_ENABLED = "true";
    setHorizonFetcherForTests((async () =>
      new Response(
        JSON.stringify({
          _embedded: {
            records: [
              {
                sequence: 55_000_002,
                closed_at: "2026-10-02T10:00:05Z",
                successful_transaction_count: 100,
                operation_count: 310,
              },
              {
                sequence: 55_000_001,
                closed_at: "2026-10-02T10:00:00Z",
                successful_transaction_count: 90,
                operation_count: 290,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch);

    const failingFetcher = async () => {
      throw new UpstreamQueryFailedError("Hubble BigQuery unavailable");
    };

    const res = await handleActivityRequest(
      new Request("http://localhost:3000/api/v1/activity?period=1d"),
      failingFetcher,
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      kpis: {
        totalOps: { value: number };
        activeDestinationAccounts: null;
      };
      treemaps: { events: { value: number } };
      degradedFallback?: {
        active: boolean;
        provider: string;
        banner: string;
      };
    };

    assert.equal(body.kpis.totalOps.value, 600);
    assert.equal(body.kpis.activeDestinationAccounts, null);
    assert.equal(body.treemaps.events.value, 0);
    assert.equal(body.degradedFallback?.active, true);
    assert.equal(body.degradedFallback?.provider, "horizon");
    assert.equal(body.degradedFallback?.banner, HORIZON_FALLBACK_BANNER_TEXT);
    assert.equal(isHorizonFallbackActive(), true);

    const healthRes = await healthGET(
      new Request("http://localhost:3000/api/health?type=readiness"),
    );
    const healthBody = (await healthRes.json()) as {
      horizonFallback?: {
        enabled: boolean;
        active: boolean;
        banner?: string;
      };
    };
    assert.equal(healthBody.horizonFallback?.enabled, true);
    assert.equal(healthBody.horizonFallback?.active, true);
    assert.equal(
      healthBody.horizonFallback?.banner,
      HORIZON_FALLBACK_BANNER_TEXT,
    );
  });
});
