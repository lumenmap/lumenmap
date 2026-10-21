import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sorobanFeeContractQuery,
  sorobanFeeSummaryQuery,
} from "@/lib/hubble/shared-queries.mjs";
import { getMethodologySection } from "@/lib/metrics/methodology";
import {
  SOROBAN_FEE_FIXTURE_AVG_RESOURCE_STROOPS,
  SOROBAN_FEE_FIXTURE_INVOKE_COUNT,
  SOROBAN_FEE_FIXTURE_RESOURCE_STROOPS,
  SOROBAN_FEE_FIXTURE_TOTAL_STROOPS,
  buildSorobanFeeFixture,
} from "@/lib/soroban-fees/fixture";
import { mapFeeNumber, mapSorobanFeeRows } from "@/lib/soroban-fees/mapper";
import { SOROBAN_FEE_COLUMNS } from "@/lib/soroban-fees/types";

describe("mapFeeNumber", () => {
  it("maps null and blank cells to zero", () => {
    assert.equal(mapFeeNumber(null), 0);
    assert.equal(mapFeeNumber(undefined), 0);
    assert.equal(mapFeeNumber(""), 0);
    assert.equal(mapFeeNumber("  "), 0);
    assert.equal(mapFeeNumber(Number.NaN), 0);
  });

  it("maps numeric strings and BigQuery value wrappers", () => {
    assert.equal(mapFeeNumber("1250000000"), 1_250_000_000);
    assert.equal(mapFeeNumber({ value: "18" }), 18);
    assert.equal(mapFeeNumber(BigInt(50_000)), 50_000);
  });
});

describe("mapSorobanFeeRows null rows", () => {
  it("maps a null summary row to zeros and a null average", () => {
    const mapped = mapSorobanFeeRows({
      summaryRows: [null],
      contractRows: [],
    });
    assert.deepEqual(mapped, {
      totalFeeStroops: 0,
      invokeCount: 0,
      resourceStroops: 0,
      avgResourceStroopsPerInvoke: null,
      topContracts: [],
    });
  });

  it("maps null aggregate cells to zero", () => {
    const mapped = mapSorobanFeeRows({
      summaryRows: [
        {
          total_fee_stroops: null,
          invoke_count: null,
          resource_stroops: null,
        },
      ],
      contractRows: [null],
    });
    assert.equal(mapped.totalFeeStroops, 0);
    assert.equal(mapped.invokeCount, 0);
    assert.equal(mapped.avgResourceStroopsPerInvoke, null);
    assert.deepEqual(mapped.topContracts, []);
  });

  it("drops null contract rows and blank contract ids", () => {
    const mapped = mapSorobanFeeRows({
      summaryRows: [
        {
          total_fee_stroops: 30,
          invoke_count: 3,
          resource_stroops: 12,
        },
      ],
      contractRows: [
        null,
        {
          contract_id: null,
          total_fee_stroops: 99,
          invoke_count: 1,
          resource_stroops: 1,
        },
        {
          contract_id: "   ",
          total_fee_stroops: 10,
          invoke_count: 1,
          resource_stroops: null,
        },
        {
          contract_id: "CVALID",
          total_fee_stroops: null,
          invoke_count: null,
          resource_stroops: null,
        },
      ],
    });
    assert.equal(mapped.avgResourceStroopsPerInvoke, 4);
    assert.deepEqual(mapped.topContracts, [
      {
        contractId: "CVALID",
        totalFeeStroops: 0,
        invokeCount: 0,
        resourceStroops: 0,
      },
    ]);
  });

  it("treats a missing summary list as an empty period", () => {
    const mapped = mapSorobanFeeRows({
      summaryRows: undefined,
      contractRows: undefined,
    });
    assert.equal(mapped.totalFeeStroops, 0);
    assert.equal(mapped.avgResourceStroopsPerInvoke, null);
  });
});

describe("soroban fee fixture and query columns", () => {
  it("documents the sample totals used by the panel", () => {
    const fixture = buildSorobanFeeFixture({
      period: "7d",
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-08T00:00:00.000Z",
    });
    assert.equal(fixture.totalFeeStroops, SOROBAN_FEE_FIXTURE_TOTAL_STROOPS);
    assert.equal(fixture.invokeCount, SOROBAN_FEE_FIXTURE_INVOKE_COUNT);
    assert.equal(
      fixture.avgResourceStroopsPerInvoke,
      SOROBAN_FEE_FIXTURE_AVG_RESOURCE_STROOPS,
    );
    assert.equal(
      fixture.totalFeeStroops,
      fixture.topContracts.reduce((sum, row) => sum + row.totalFeeStroops, 0),
    );
    assert.equal(
      fixture.invokeCount,
      fixture.topContracts.reduce((sum, row) => sum + row.invokeCount, 0),
    );
    const resource = fixture.topContracts.reduce(
      (sum, row) => sum + row.resourceStroops,
      0,
    );
    assert.equal(resource, SOROBAN_FEE_FIXTURE_RESOURCE_STROOPS);
    assert.equal(resource / fixture.invokeCount, fixture.avgResourceStroopsPerInvoke);

    const section = getMethodologySection("soroban-fees");
    assert.match(section.summary, /1,250,000,000/);
    assert.match(section.summary, /50,000/);
    assert.match(section.summary, /18,000/);
    const sql = `${sorobanFeeSummaryQuery}\n${sorobanFeeContractQuery}`;
    for (const column of SOROBAN_FEE_COLUMNS) {
      assert.match(section.source, new RegExp(column));
      assert.match(sql, new RegExp(column));
    }
  });
});
