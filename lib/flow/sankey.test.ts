import assert from "node:assert/strict";
import { test } from "node:test";
import type { FlowEdge } from "./graph";
import { FIXTURE_FLOW_EDGES } from "./fixtures";
import { buildSankeyGroups, SANKEY_TOP_N_PER_ASSET } from "./sankey";

const edge = (id: string, assetKey: string, amount: string, amountComplete = true): FlowEdge => ({
  id, source: "GA", destination: "GB", assetKey,
  asset: { code: assetKey === "native:XLM" ? "XLM" : assetKey.split(":")[0] },
  amount, amountComplete, operationCount: 1,
});

test("fixture payment edges produce separate XLM and USDC Sankey groups", () => {
  const groups = buildSankeyGroups(FIXTURE_FLOW_EDGES);
  assert.equal(groups.length, 2);
  assert.deepEqual(new Set(groups.map((group) => group.asset)), new Set(["XLM", "USDC"]));
  assert.equal(groups.find((group) => group.asset === "XLM")?.edges.length, 3);
  assert.ok(groups.every((group) => group.coveragePercent === 100));
});

test("restricts assets, excludes incomplete amounts, and keeps USDC issuers separate", () => {
  const groups = buildSankeyGroups([
    edge("xlm", "native:XLM", "100"),
    edge("usdc-a", "USDC:GISSUER1", "200"),
    edge("usdc-b", "USDC:GISSUER2", "300"),
    edge("eurc", "EURC:GISSUER1", "5000"),
    edge("incomplete", "native:XLM", "9000", false),
    edge("zero", "native:XLM", "0"),
  ]);
  assert.deepEqual(groups.map((group) => group.assetKey).sort(), ["USDC:GISSUER1", "USDC:GISSUER2", "native:XLM"].sort());
  assert.equal(groups.find((group) => group.asset === "XLM")?.edges.length, 1);
  assert.deepEqual(buildSankeyGroups([edge("eurc", "EURC:GISSUER1", "5")]), []);
});

test("caps by amount within an asset and reports returned-volume coverage", () => {
  const edges = Array.from({ length: SANKEY_TOP_N_PER_ASSET + 1 }, (_, index) => edge(String(index), "native:XLM", String(index + 1)));
  const [group] = buildSankeyGroups(edges);
  assert.equal(group.edges.length, SANKEY_TOP_N_PER_ASSET);
  assert.equal(group.edges[0].amount, String(SANKEY_TOP_N_PER_ASSET + 1));
  assert.equal(group.edges.at(-1)?.amount, "2");
  assert.equal(group.coveragePercent, 99.5);
});
