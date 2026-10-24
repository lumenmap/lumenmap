import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TREEMAP_DIFF_CLAMP_PERCENT,
  TREEMAP_DIFF_BUCKET_COLORS,
  buildTreemapDiffIndex,
  calculateTreemapDelta,
  classifyDelta,
  clampDiffPercent,
  diffColor,
  diffColorBucket,
  formatTreemapDeltaText,
  treemapNodeKey,
  treemapPathKey,
} from "./treemap-diff";
import type { TreemapNode } from "@/lib/types";

function node(
  name: string,
  value: number | undefined,
  extra: Partial<TreemapNode> = {},
): TreemapNode {
  return { name, value, ...extra };
}

describe("treemapNodeKey", () => {
  it("prefers meta.id, then node id, then name", () => {
    assert.equal(
      treemapNodeKey(node("A", 1, { meta: { type: "contract", id: "C1" } })),
      "C1",
    );
    assert.equal(treemapNodeKey(node("A", 1, { id: "I1" })), "I1");
    assert.equal(treemapNodeKey(node("A", 1)), "A");
  });
});

describe("treemapPathKey", () => {
  it("joins node keys from the root down", () => {
    const path = [
      node("Soroban", 10, { id: "soroban" }),
      node("Swap", 5, { id: "swap" }),
    ];
    assert.equal(treemapPathKey(path), "soroban/swap");
  });

  it("returns an empty string for an empty path", () => {
    assert.equal(treemapPathKey([]), "");
  });
});

describe("classifyDelta", () => {
  it("classifies growth, decline, and flat changes", () => {
    assert.equal(classifyDelta(120, 100), "grew");
    assert.equal(classifyDelta(80, 100), "declined");
    assert.equal(classifyDelta(100, 100), "flat");
  });

  it("classifies a node with previous value zero as new", () => {
    assert.equal(classifyDelta(50, 0), "new");
  });

  it("classifies a node with current value zero as dropped", () => {
    assert.equal(classifyDelta(0, 50), "dropped");
  });

  it("treats zero versus zero as flat", () => {
    assert.equal(classifyDelta(0, 0), "flat");
  });
});

describe("calculateTreemapDelta", () => {
  it("computes absolute and percent change", () => {
    const delta = calculateTreemapDelta("k", 150, 100);
    assert.equal(delta.absolute, 50);
    assert.equal(delta.percent, 50);
    assert.equal(delta.kind, "grew");
  });

  it("computes negative percent change for decline", () => {
    const delta = calculateTreemapDelta("k", 80, 100);
    assert.equal(delta.absolute, -20);
    assert.equal(delta.percent, -20);
    assert.equal(delta.kind, "declined");
  });

  it("returns a null percent for new nodes", () => {
    const delta = calculateTreemapDelta("k", 40, 0);
    assert.equal(delta.percent, null);
    assert.equal(delta.kind, "new");
  });

  it("returns -100 percent for dropped nodes", () => {
    const delta = calculateTreemapDelta("k", 0, 40);
    assert.equal(delta.absolute, -40);
    assert.equal(delta.percent, -100);
    assert.equal(delta.kind, "dropped");
  });
});

describe("clampDiffPercent", () => {
  it("clamps growth and decline into the configured band", () => {
    assert.equal(clampDiffPercent(85), TREEMAP_DIFF_CLAMP_PERCENT);
    assert.equal(clampDiffPercent(-320), -TREEMAP_DIFF_CLAMP_PERCENT);
    assert.equal(clampDiffPercent(12.5), 12.5);
  });
});

describe("diffColorBucket", () => {
  it("maps new and dropped nodes to their dedicated buckets", () => {
    assert.equal(
      diffColorBucket(calculateTreemapDelta("k", 10, 0)),
      "new",
    );
    assert.equal(
      diffColorBucket(calculateTreemapDelta("k", 0, 10)),
      "strong-decline",
    );
  });

  it("maps growth and decline into flat, growth, and strong bands", () => {
    assert.equal(diffColorBucket(calculateTreemapDelta("k", 105, 100)), "flat");
    assert.equal(diffColorBucket(calculateTreemapDelta("k", 110, 100)), "growth");
    assert.equal(
      diffColorBucket(calculateTreemapDelta("k", 150, 100)),
      "strong-growth",
    );
    assert.equal(
      diffColorBucket(calculateTreemapDelta("k", 200, 100)),
      "strong-growth",
    );
  });

  it("maps decline into flat, decline, and strong bands at band edges", () => {
    assert.equal(diffColorBucket(calculateTreemapDelta("k", 95, 100)), "flat");
    assert.equal(diffColorBucket(calculateTreemapDelta("k", 90, 100)), "decline");
    assert.equal(
      diffColorBucket(calculateTreemapDelta("k", 50, 100)),
      "strong-decline",
    );
  });

  it("returns a color for every bucket", () => {
    for (const bucket of [
      "new",
      "strong-growth",
      "growth",
      "flat",
      "decline",
      "strong-decline",
    ] as const) {
      assert.match(TREEMAP_DIFF_BUCKET_COLORS[bucket], /^#/);
    }
  });
});

describe("diffColor", () => {
  it("resolves to the diverging color of the delta's bucket", () => {
    assert.equal(
      diffColor(calculateTreemapDelta("k", 200, 100)),
      TREEMAP_DIFF_BUCKET_COLORS["strong-growth"],
    );
    assert.equal(
      diffColor(calculateTreemapDelta("k", 50, 100)),
      TREEMAP_DIFF_BUCKET_COLORS["strong-decline"],
    );
    assert.equal(
      diffColor(calculateTreemapDelta("k", 101, 100)),
      TREEMAP_DIFF_BUCKET_COLORS.flat,
    );
  });
});

describe("formatTreemapDeltaText", () => {
  it("describes new nodes in words without a percent", () => {
    assert.equal(
      formatTreemapDeltaText(calculateTreemapDelta("k", 40, 0)),
      "new in this window (no previous activity)",
    );
  });

  it("describes dropped nodes with the previous value", () => {
    assert.equal(
      formatTreemapDeltaText(calculateTreemapDelta("k", 0, 4_000)),
      "dropped since previous window (was 4.0K)",
    );
  });

  it("includes a signed compact absolute and signed percent for changes", () => {
    assert.equal(
      formatTreemapDeltaText(calculateTreemapDelta("k", 12_000, 10_000)),
      "+2.0K (+20.0%) vs previous window",
    );
    assert.equal(
      formatTreemapDeltaText(calculateTreemapDelta("k", 8_000, 10_000)),
      "-2.0K (-20.0%) vs previous window",
    );
  });
});

describe("buildTreemapDiffIndex", () => {
  const previousTree = node("Root", 150, {
    children: [
      node("Payments", 100, {
        id: "payments",
        children: [
          node("Payment", 100, { id: "payment", meta: { type: "entity", id: "payment", opCount: 100 } }),
        ],
      }),
      node("DEX", 50, {
        id: "dex",
        children: [node("Swap Offer", 50, { id: "offer" })],
      }),
    ],
  });

  const currentTree = node("Root", 155, {
    children: [
      node("Payments", 100, {
        id: "payments",
        children: [
          node("Payment", 125, { id: "payment", meta: { type: "entity", id: "payment", opCount: 125 } }),
        ],
      }),
      // "dex" dropped entirely, "soroban" is new entirely.
      node("Soroban", 55, {
        id: "soroban",
        children: [node("Transfer", 55, { id: "transfer" })],
      }),
    ],
  });

  it("indexes deltas for every node by path-qualified key", () => {
    const { deltas } = buildTreemapDiffIndex(currentTree, previousTree);

    assert.equal(deltas.get("payments")?.kind, "flat");
    assert.equal(deltas.get("payments/payment")?.kind, "grew");
    assert.equal(deltas.get("payments/payment")?.percent, 25);
    assert.equal(deltas.get("soroban")?.kind, "new");
    assert.equal(deltas.get("soroban/transfer")?.kind, "new");
    assert.equal(deltas.get("dex")?.kind, "dropped");
    assert.equal(deltas.get("dex")?.percent, -100);
  });

  it("uses meta.opCount when a node has no value", () => {
    const current = node("Root", 0, {
      children: [node("A", undefined, { meta: { type: "entity", id: "a", opCount: 30 } })],
    });
    const previous = node("Root", 0, {
      children: [node("A", undefined, { meta: { type: "entity", id: "a", opCount: 20 } })],
    });

    const { deltas } = buildTreemapDiffIndex(current, previous);
    assert.equal(deltas.get("a")?.current, 30);
    assert.equal(deltas.get("a")?.previous, 20);
    assert.equal(deltas.get("a")?.kind, "grew");
  });

  it("groups dropped nodes under their parent path key", () => {
    const { droppedByParent } = buildTreemapDiffIndex(currentTree, previousTree);

    const rootDropped = droppedByParent.get("") ?? [];
    assert.equal(rootDropped.length, 1);
    assert.equal(rootDropped[0].name, "DEX");
    assert.equal(droppedByParent.size, 1);
  });

  it("does not walk the subtree of a dropped node", () => {
    const { deltas } = buildTreemapDiffIndex(currentTree, previousTree);
    assert.equal(deltas.has("dex/offer"), false);
  });

  it("matches nodes by stable id even when the label changed", () => {
    const current = node("Root", 0, {
      children: [node("Renamed", 120, { id: "payments" })],
    });
    const previous = node("Root", 0, {
      children: [node("Payments", 100, { id: "payments" })],
    });

    const { deltas, droppedByParent } = buildTreemapDiffIndex(current, previous);
    assert.equal(deltas.get("payments")?.kind, "grew");
    assert.equal(droppedByParent.size, 0);
  });

  it("treats a missing previous tree as every active node being new", () => {
    const { deltas } = buildTreemapDiffIndex(currentTree, null);
    assert.equal(deltas.get("payments")?.kind, "new");
    assert.equal(deltas.get("payments/payment")?.kind, "new");
  });

  it("treats a missing current tree as every previous node being dropped", () => {
    const { deltas, droppedByParent } = buildTreemapDiffIndex(null, previousTree);
    assert.equal(deltas.get("payments")?.kind, "dropped");
    assert.equal((droppedByParent.get("") ?? []).length, 2);
  });

  it("handles undefined inputs", () => {
    const { deltas, droppedByParent } = buildTreemapDiffIndex(undefined, undefined);
    assert.equal(deltas.size, 0);
    assert.equal(droppedByParent.size, 0);
  });
});
