import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildAllTreemaps } from "@/lib/entities/build-treemap";
import {
  OPERATION_COUNT_UNIT,
  XLM_ASSET_UNIT,
  type MetricId,
  type TreemapPayload,
} from "@/lib/types";

const supportedMetrics: MetricId[] = [
  "operation_count",
  "transaction_count",
  "asset_volume",
  "tvl",
];

const validCountPayload: TreemapPayload<"operation_count"> = {
  name: "Operations",
  value: 12,
  metric: "operation_count",
  unit: OPERATION_COUNT_UNIT,
};

const invalidCountUnit: TreemapPayload<"operation_count"> = {
  name: "Operations",
  value: 12,
  metric: "operation_count",
  // @ts-expect-error Operation counts cannot carry asset units.
  unit: XLM_ASSET_UNIT,
};

const invalidAssetValue: TreemapPayload<"asset_volume"> = {
  name: "Volume",
  metric: "asset_volume",
  unit: XLM_ASSET_UNIT,
  // @ts-expect-error Asset-denominated values serialize as decimal strings.
  value: 12,
};

describe("treemap metric contract", () => {
  test("defines all supported metric identifiers", () => {
    assert.deepEqual(supportedMetrics, [
      "operation_count",
      "transaction_count",
      "asset_volume",
      "tvl",
    ]);
    assert.equal(validCountPayload.unit.kind, "count");
    assert.ok(invalidCountUnit);
    assert.ok(invalidAssetValue);
  });

  test("serializes operation and asset treemaps with self-describing units", () => {
    const treemaps = buildAllTreemaps({
      categories: [
        { type_string: "payment", op_count: 7, xlm_volume: 12.5 },
      ],
      contracts: [],
      accounts: [],
      sorobanFunctions: [],
      sorobanFunctionContracts: [],
    });

    assert.deepEqual(treemaps.events.unit, OPERATION_COUNT_UNIT);
    assert.equal(treemaps.events.metric, "operation_count");
    assert.equal(treemaps.events.value, 7);

    const serializedOperations = JSON.parse(
      JSON.stringify(treemaps.events),
    ) as {
      metric: string;
      unit: { kind: string; subject: string };
      value: number;
    };
    assert.equal(serializedOperations.metric, "operation_count");
    assert.equal(serializedOperations.unit.kind, "count");
    assert.equal(serializedOperations.unit.subject, "operation");
    assert.equal(typeof serializedOperations.value, "number");

    assert.deepEqual(treemaps.xlm_events.unit, XLM_ASSET_UNIT);
    assert.equal(treemaps.xlm_events.metric, "asset_volume");
    assert.equal(treemaps.xlm_events.value, "12.5");

    const serialized = JSON.parse(JSON.stringify(treemaps.xlm_events)) as {
      metric: string;
      unit: { kind: string; asset: { code: string } };
      value: string;
    };
    assert.equal(serialized.metric, "asset_volume");
    assert.equal(serialized.unit.kind, "asset");
    assert.equal(serialized.unit.asset.code, "XLM");
    assert.equal(typeof serialized.value, "string");
  });
});
