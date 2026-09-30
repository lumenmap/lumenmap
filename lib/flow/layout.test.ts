import assert from "node:assert/strict";
import { test } from "node:test";
import { FLOW_FIXTURE } from "@/lib/fixtures/flow";
import { layoutFlow } from "@/lib/flow/layout";

test("fixture graph has a bounded, repeatable layout with valid connections", () => {
  const { nodes, edges } = FLOW_FIXTURE;
  const first = layoutFlow(nodes, edges);
  assert.ok(first.length >= 3);
  assert.ok(edges.length >= 2);
  assert.deepEqual(first, layoutFlow(nodes, edges));
  const ids = new Set(first.map((node) => node.id));
  for (const edge of edges) {
    assert.ok(ids.has(edge.source));
    assert.ok(ids.has(edge.destination));
  }
  for (const node of first) {
    assert.ok(node.x >= 0.08 && node.x <= 0.92);
    assert.ok(node.y >= 0.08 && node.y <= 0.92);
  }
});
