import assert from "node:assert/strict";
import { test } from "node:test";
import { FIXTURE_ACCOUNTS } from "@/lib/fixtures/raw-data";
import { FIXTURE_FLOW_EDGES } from "./fixtures";
import { buildFlowGraph } from "./graph";
import { flowQuery } from "./data";

test("fixture ego graph includes only the selected account and direct counterparties", () => {
  const graph = buildFlowGraph(FIXTURE_FLOW_EDGES, FIXTURE_ACCOUNTS.kraken);
  assert.deepEqual(
    new Set(graph.nodes.map((node) => node.id)),
    new Set([FIXTURE_ACCOUNTS.kraken, FIXTURE_ACCOUNTS.lobstr, FIXTURE_ACCOUNTS.moneygram]),
  );
  assert.deepEqual(graph.edges.map((edge) => edge.id), ["kraken-lobstr-xlm", "moneygram-kraken-xlm"]);
});

test("empty ego graph retains the selected account for the empty state", () => {
  const graph = buildFlowGraph(FIXTURE_FLOW_EDGES, FIXTURE_ACCOUNTS.unknownC);
  assert.deepEqual(graph.nodes.map((node) => node.id), [FIXTURE_ACCOUNTS.unknownC]);
  assert.equal(graph.edges.length, 0);
});

test("overview includes the edge outside the ego neighborhood", () => {
  const graph = buildFlowGraph(FIXTURE_FLOW_EDGES);
  assert.equal(graph.edges.length, 4);
  assert.ok(graph.nodes.some((node) => node.id === FIXTURE_ACCOUNTS.unknownA));
});

test("ego SQL filters before ranking and uses a bound account", () => {
  const query = flowQuery("crypto-stellar.crypto_stellar_dbt", true);
  assert.match(query, /source = @account OR destination = @account/);
  assert.ok(query.indexOf("source = @account") < query.indexOf("ORDER BY operation_count"));
  assert.doesNotMatch(flowQuery("crypto-stellar.crypto_stellar_dbt", false), /@account/);
});
