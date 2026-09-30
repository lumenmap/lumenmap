import type { FlowGraph } from "@/lib/types/flow";

/**
 * Fixture flow graphs keyed by period. Used when live credentials are
 * absent so the Flow UI can render deterministic data in development and
 * test environments.
 */
export const flowGraphFixtures: Record<string, FlowGraph> = {
  "1d": {
    period: "1d",
    generatedAt: "2024-01-01T00:00:00.000Z",
    source: "fixture",
    nodes: [
      { id: "account:alice", label: "Alice", kind: "account", value: 1250 },
      { id: "account:bob", label: "Bob", kind: "account", value: 980 },
      { id: "account:carol", label: "Carol", kind: "account", value: 640 },
      { id: "account:dave", label: "Dave", kind: "account", value: 410 },
    ],
    edges: [
      { id: "alice->bob", source: "account:alice", target: "account:bob", value: 320, count: 12 },
      { id: "bob->carol", source: "account:bob", target: "account:carol", value: 180, count: 7 },
      { id: "carol->dave", source: "account:carol", target: "account:dave", value: 95, count: 4 },
      { id: "dave->alice", source: "account:dave", target: "account:alice", value: 40, count: 2 },
    ],
  },
  "7d": {
    period: "7d",
    generatedAt: "2024-01-01T00:00:00.000Z",
    source: "fixture",
    nodes: [
      { id: "account:alice", label: "Alice", kind: "account", value: 8700 },
      { id: "account:bob", label: "Bob", kind: "account", value: 6420 },
      { id: "account:carol", label: "Carol", kind: "account", value: 4100 },
      { id: "account:dave", label: "Dave", kind: "account", value: 2850 },
    ],
    edges: [
      { id: "alice->bob", source: "account:alice", target: "account:bob", value: 2100, count: 64 },
      { id: "bob->carol", source: "account:bob", target: "account:carol", value: 1250, count: 41 },
      { id: "carol->dave", source: "account:carol", target: "account:dave", value: 670, count: 23 },
      { id: "dave->alice", source: "account:dave", target: "account:alice", value: 280, count: 11 },
    ],
  },
  "30d": {
    period: "30d",
    generatedAt: "2024-01-01T00:00:00.000Z",
    source: "fixture",
    nodes: [
      { id: "account:alice", label: "Alice", kind: "account", value: 34200 },
      { id: "account:bob", label: "Bob", kind: "account", value: 28750 },
      { id: "account:carol", label: "Carol", kind: "account", value: 19800 },
      { id: "account:dave", label: "Dave", kind: "account", value: 12400 },
    ],
    edges: [
      { id: "alice->bob", source: "account:alice", target: "account:bob", value: 9800, count: 275 },
      { id: "bob->carol", source: "account:bob", target: "account:carol", value: 5600, count: 189 },
      { id: "carol->dave", source: "account:carol", target: "account:dave", value: 3100, count: 98 },
      { id: "dave->alice", source: "account:dave", target: "account:alice", value: 1400, count: 52 },
    ],
  },
  "90d": {
    period: "90d",
    generatedAt: "2024-01-01T00:00:00.000Z",
    source: "fixture",
    nodes: [
      { id: "account:alice", label: "Alice", kind: "account", value: 98700 },
      { id: "account:bob", label: "Bob", kind: "account", value: 84300 },
      { id: "account:carol", label: "Carol", kind: "account", value: 56200 },
      { id: "account:dave", label: "Dave", kind: "account", value: 37600 },
    ],
    edges: [
      { id: "alice->bob", source: "account:alice", target: "account:bob", value: 28400, count: 810 },
      { id: "bob->carol", source: "account:bob", target: "account:carol", value: 16700, count: 542 },
      { id: "carol->dave", source: "account:carol", target: "account:dave", value: 9200, count: 310 },
      { id: "dave->alice", source: "account:dave", target: "account:alice", value: 4100, count: 145 },
    ],
  },
};

/**
 * Returns the fixture flow graph for the given period. Throws if the period
 * has no fixture registered.
 */
export function getFlowGraphFixture(period: string): FlowGraph {
  const graph = flowGraphFixtures[period];
  if (!graph) {
    throw new Error(`No flow graph fixture registered for period: ${period}`);
  }
  return graph;
}
