import type { FlowTableEdge, FlowTableNode } from "@/components/dashboard/FlowDataTable";

export interface PositionedFlowNode extends FlowTableNode {
  x: number;
  y: number;
}

/** Deterministic, bounded force layout in normalized coordinates. */
export function layoutFlow(nodes: readonly FlowTableNode[], edges: readonly FlowTableEdge[]): PositionedFlowNode[] {
  if (nodes.length === 0) return [];
  const positions = nodes.map((node, i) => ({
    ...node,
    x: Math.cos((i * 2 * Math.PI) / nodes.length) * 0.32,
    y: Math.sin((i * 2 * Math.PI) / nodes.length) * 0.32,
  }));
  const byId = new Map(positions.map((node, i) => [node.id, i]));
  for (let step = 0; step < 160; step++) {
    const forces = positions.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < positions.length; i++) {
      forces[i].x -= positions[i].x * 0.012;
      forces[i].y -= positions[i].y * 0.012;
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const distanceSquared = Math.max(dx * dx + dy * dy, 0.0025);
        const push = 0.00045 / distanceSquared;
        forces[i].x -= dx * push;
        forces[i].y -= dy * push;
        forces[j].x += dx * push;
        forces[j].y += dy * push;
      }
    }
    for (const edge of edges) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.destination);
      if (source === undefined || target === undefined || source === target) continue;
      const dx = positions[target].x - positions[source].x;
      const dy = positions[target].y - positions[source].y;
      const distance = Math.hypot(dx, dy) || 1;
      const pull = (distance - 0.42) * 0.018;
      forces[source].x += (dx / distance) * pull;
      forces[source].y += (dy / distance) * pull;
      forces[target].x -= (dx / distance) * pull;
      forces[target].y -= (dy / distance) * pull;
    }
    positions.forEach((node, i) => {
      node.x = Math.max(-0.42, Math.min(0.42, node.x + forces[i].x));
      node.y = Math.max(-0.42, Math.min(0.42, node.y + forces[i].y));
    });
  }
  return positions.map((node) => ({ ...node, x: node.x + 0.5, y: node.y + 0.5 }));
}
