import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateHorizonOperations,
  fetchHorizonFallbackDataset,
  getHorizonBaseUrl,
  isHorizonFallbackEnabled,
  type HorizonOperationRecord,
} from "./horizon-fallback";

describe("Horizon fallback read path", () => {
  it("resolves fallback enablement and network base URLs", () => {
    assert.equal(isHorizonFallbackEnabled({}), false);
    assert.equal(
      isHorizonFallbackEnabled({ LUMENMAP_HORIZON_FALLBACK: "true" }),
      true,
    );
    assert.equal(
      isHorizonFallbackEnabled({ LUMENMAP_DATA_SOURCE: "horizon" }),
      true,
    );

    assert.equal(getHorizonBaseUrl("mainnet", {}), "https://horizon.stellar.org");
    assert.equal(
      getHorizonBaseUrl("testnet", {}),
      "https://horizon-testnet.stellar.org",
    );
    assert.equal(
      getHorizonBaseUrl("mainnet", {
        STELLAR_HORIZON_URL: "https://custom-horizon.example.org/",
      }),
      "https://custom-horizon.example.org",
    );
  });

  it("aggregates Horizon operation records into categories, accounts, contracts, and KPIs", () => {
    const sampleRecords: HorizonOperationRecord[] = [
      {
        id: "1",
        type: "payment",
        created_at: "2026-08-03T10:00:00Z",
        source_account: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        to: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        asset_type: "native",
        amount: "125.5",
      },
      {
        id: "2",
        type: "invoke_host_function",
        created_at: "2026-08-03T11:00:00Z",
        source_account: "GDKJ3ZXB5RA2MV5T2Y3Z5D3D3VKR5F7EFRB2A3BMBC3IHGBOK5GDI2LQ",
        contract: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
      },
    ];

    const agg = aggregateHorizonOperations(sampleRecords);
    assert.equal(agg.categories.length, 2);
    assert.equal(agg.contracts.length, 1);
    assert.equal(
      agg.contracts[0]?.contract_id,
      "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    );
    assert.equal(agg.activeSourceAccounts[0]?.active_accounts, 2);
    assert.equal(agg.activeDestinationCount.active_destination_count, 1);
    assert.equal(agg.latestTimestamp, "2026-08-03T11:00:00Z");
  });

  it("builds a complete ActivityDataset from mocked Horizon /operations response", async () => {
    const mockFetch: typeof globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          _embedded: {
            records: [
              {
                id: "101",
                type: "payment",
                created_at: "2026-08-03T12:00:00Z",
                source_account:
                  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
                to: "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM",
                asset_type: "native",
                amount: "500.0",
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const dataset = await fetchHorizonFallbackDataset("1d", "mainnet", {
      fetchImpl: mockFetch,
    });
    assert.equal(dataset.period, "1d");
    assert.equal(dataset.kpis.totalOps.value, 1);
    assert.equal(dataset.kpis.activeWallets.value, 1);
    assert.equal(dataset.sourceTimestamp, "2026-08-03T12:00:00Z");
    assert.ok(dataset.treemaps.events);
    assert.ok(dataset.treemaps.actors);
  });
});
