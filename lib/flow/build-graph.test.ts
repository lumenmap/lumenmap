import { describe, expect, it } from "vitest";

import { buildFlowGraph } from "@/lib/flow/build-graph";
import type { FlowEdgeRow } from "@/lib/flow/types";
import {
  FIXTURE_FLOW_EDGE_ROWS,
  buildFixtureFlowGraph,
} from "@/lib/fixtures/flow-graph";

const ACCOUNT_A = "GA5ZSEJYB37JRC5AVCIA5MOP4RGHTM335XKKX3IHOJAPP5RE34K4KZVN";
const ACCOUNT_B = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNKNLXLTCV";
const CONTRACT_A = "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2";
const CONTRACT_B = "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF";

describe("buildFlowGraph", () => {
  it("dedupes nodes by id across rows", () => {
    const rows: FlowEdgeRow[] = [
      { source_id: ACCOUNT_A, target_id: CONTRACT_A, op_count: 10 },
      { source_id: ACCOUNT_A, target_id: CONTRACT_B, op_count: 5 },
    ];
    const graph = buildFlowGraph(rows);
    const ids = graph.nodes.map((n) => n.id).sort();
    expect(ids).toEqual([ACCOUNT_A, CONTRACT_A, CONTRACT_B].sort());
    expect(graph.nodes.length).toBeGreaterOrEqual(3);
  });

  it("aggregates parallel edges by id with summed metrics", () => {
    const rows: FlowEdgeRow[] = [
      {
        source_id: ACCOUNT_A,
        target_id: CONTRACT_A,
        op_count: 10,
        txn_count: 4,
        xlm_volume: 1000,
        asset_keys: ["xlm:native"],
      },
      {
        source_id: ACCOUNT_A,
        target_id: CONTRACT_A,
        op_count: 5,
        txn_count: 2,
        xlm_volume: 500,
        asset_keys: ["usdc:issuer"],
      },
    ];
    const graph = buildFlowGraph(rows);
    expect(graph.edges).toHaveLength(1);
    const edge = graph.edges[0];
    expect(edge.source).toBe(ACCOUNT_A);
    expect(edge.target).toBe(CONTRACT_A);
    expect(edge.metrics.opCount).toBe(15);
    expect(edge.metrics.txnCount).toBe(6);
    expect(edge.metrics.xlmVolume).toBe(1500);
    expect(edge.assetKeys).toEqual(["usdc:issuer", "xlm:native"]);
  });

  it("aggregates node metrics from inbound and outbound edges", () => {
    const rows: FlowEdgeRow[] = [
      { source_id: ACCOUNT_A, target_id: CONTRACT_A, op_count: 10 },
      { source_id: CONTRACT_A, target_id: ACCOUNT_B, op_count: 7 },
    ];
    const graph = buildFlowGraph(rows);
    const contract = graph.nodes.find((n) => n.id === CONTRACT_A);
    expect(contract?.metrics.opCount).toBe(17);
    expect(contract?.kind).toBe("contract");
  });

  it("respects label and kind overrides", () => {
    const rows: FlowEdgeRow[] = [
      { source_id: ACCOUNT_A, target_id: CONTRACT_A, op_count: 1 },
    ];
    const graph = buildFlowGraph(rows, {
      labels: { [ACCOUNT_A]: "Account A" },
      kinds: { [ACCOUNT_A]: "protocol" },
    });
    const node = graph.nodes.find((n) => n.id === ACCOUNT_A);
    expect(node).toMatchObject({ label: "Account A", kind: "protocol" });
  });

  it("loads the fixture dataset without credentials", () => {
    const graph = buildFixtureFlowGraph();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeLessThanOrEqual(FIXTURE_FLOW_EDGE_ROWS.length);
  });
});
