import type { TreemapNode } from "@/lib/types";

export function getNodeValue(node: TreemapNode): number {
  return node.value ?? node.meta?.opCount ?? 0;
}

export function resolveActiveLevel(
  root: TreemapNode,
  path: TreemapNode[],
): { currentNode: TreemapNode; children: TreemapNode[]; levelTotal: number } {
  const currentNode = path.length > 0 ? path[path.length - 1] : root;
  const children = currentNode.children ?? [];
  const childSum = children.reduce((sum, child) => sum + getNodeValue(child), 0);
  const levelTotal = childSum > 0 ? childSum : getNodeValue(currentNode);

  return { currentNode, children, levelTotal };
}
