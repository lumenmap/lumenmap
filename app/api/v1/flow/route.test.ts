import assert from "node:assert/strict";
import { test } from "node:test";
import { FIXTURE_ACCOUNTS } from "@/lib/fixtures/raw-data";
import { FIXTURE_FLOW_EDGES } from "@/lib/flow/fixtures";
import { buildFlowGraph } from "@/lib/flow/graph";
import { GET, handleFlowRequest } from "./route";

test("flow route passes the account parameter and returns a 1-hop node set", async () => {
  const calls: Array<[string, string, string | null]> = [];
  const fetcher: Parameters<typeof handleFlowRequest>[1] = async (period, network, account) => {
    calls.push([period, network, account]);
    return {
      period,
      account,
      source: "fixture",
      sampled: false,
      ...buildFlowGraph(FIXTURE_FLOW_EDGES, account ?? undefined),
    };
  };
  const base = "http://localhost/api/v1/flow?period=7d";
  const focused = await handleFlowRequest(new Request(`${base}&account=${FIXTURE_ACCOUNTS.kraken}`), fetcher);
  assert.equal(focused.status, 200);
  assert.deepEqual(calls[0], ["7d", "mainnet", FIXTURE_ACCOUNTS.kraken]);
  const ego = await focused.json();
  assert.deepEqual(new Set(ego.nodes.map((node: { id: string }) => node.id)), new Set([
    FIXTURE_ACCOUNTS.kraken, FIXTURE_ACCOUNTS.lobstr, FIXTURE_ACCOUNTS.moneygram,
  ]));

  const overview = await handleFlowRequest(new Request(base), fetcher);
  assert.equal((await overview.json()).edges.length, 4);
  assert.deepEqual(calls[1], ["7d", "mainnet", null]);
});

test("flow route rejects malformed account before fetching", async () => {
  let called = false;
  const response = await handleFlowRequest(
    new Request("http://localhost/api/v1/flow?account=invalid"),
    async () => { called = true; throw new Error("unexpected"); },
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("fixture route returns an empty ego graph and a populated overview", async () => {
  const previous = process.env.LUMENMAP_DATA_SOURCE;
  process.env.LUMENMAP_DATA_SOURCE = "fixture";
  try {
    const base = "http://localhost/api/v1/flow?period=1d";
    const empty = await GET(new Request(`${base}&account=${FIXTURE_ACCOUNTS.unknownC}`));
    assert.equal(empty.status, 200);
    const body = await empty.json();
    assert.deepEqual(body.nodes.map((node: { id: string }) => node.id), [FIXTURE_ACCOUNTS.unknownC]);
    assert.deepEqual(body.edges, []);

    const overview = await GET(new Request(base));
    assert.equal(overview.status, 200);
    assert.equal((await overview.json()).edges.length, 4);
  } finally {
    if (previous === undefined) delete process.env.LUMENMAP_DATA_SOURCE;
    else process.env.LUMENMAP_DATA_SOURCE = previous;
  }
});
