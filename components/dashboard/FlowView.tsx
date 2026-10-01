"use client";

import { useMemo } from "react";
import { FlowCanvas } from "./FlowCanvas";
import { FlowDataTable, FlowViewToggle } from "./FlowDataTable";
import { useDashboard } from "./DashboardProvider";
import type { FlowTableNode, FlowTableEdge } from "./FlowDataTable";
import type { TreemapNode } from "@/lib/types";

export function FlowView() {
  const { data, flowView, setFlowView, selectedNode, setSelectedNode } = useDashboard();

  // Convert treemap data to flow graph nodes and edges
  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };

    const flowNodes: FlowTableNode[] = [];
    const flowEdges: FlowTableEdge[] = [];
    const nodeSet = new Set<string>();

    // Extract nodes from treemap data
    const extractNodes = (treemapNode: TreemapNode, category?: string) => {
      if (treemapNode.meta?.id && !nodeSet.has(treemapNode.meta.id)) {
        nodeSet.add(treemapNode.meta.id);
        flowNodes.push({
          id: treemapNode.meta.id,
          label: treemapNode.name,
          category: treemapNode.meta?.category || category,
        });
      }
      if (treemapNode.children) {
        for (const child of treemapNode.children) {
          extractNodes(child, treemapNode.meta?.category || category);
        }
      }
    };

    // Extract from events treemap
    if (data.treemaps.events) {
      extractNodes(data.treemaps.events);
    }

    // Generate edges based on activity patterns
    // For MVP, we'll create edges between nodes that share categories
    const categoryGroups = new Map<string, FlowTableNode[]>();
    for (const node of flowNodes) {
      const cat = node.category || "other";
      if (!categoryGroups.has(cat)) {
        categoryGroups.set(cat, []);
      }
      categoryGroups.get(cat)!.push(node);
    }

    // Create edges within categories (simulated flow)
    let edgeId = 0;
    for (const categoryNodes of categoryGroups.values()) {
      if (categoryNodes.length > 1) {
        for (let i = 0; i < categoryNodes.length - 1; i++) {
          const source = categoryNodes[i];
          const target = categoryNodes[i + 1];
          // Simulate operation count based on node index (higher index = more activity)
          const operationCount = (i + 1) * 100;
          flowEdges.push({
            id: `edge-${edgeId++}`,
            source: source.id,
            destination: target.id,
            assetKey: "native:XLM",
            amount: String(operationCount * 10_000_000), // Convert to stroops
            operationCount,
          });
        }
      }
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [data]);

  const handleSelect = (id: string) => {
    // Find the node and set it as selected
    const node = nodes.find((n) => n.id === id);
    if (node) {
      setSelectedNode({
        name: node.label,
        value: 0,
        share: 0,
        meta: {
          type: "entity",
          id: node.id,
          category: node.category,
        },
      });
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-white/5 bg-black/20 text-center text-sm text-zinc-500">
        No flow data available for this period.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Flow Graph</h2>
        <FlowViewToggle view={flowView} onChange={setFlowView} />
      </div>

      {flowView === "graph" ? (
        <div className="h-[600px] w-full rounded-xl border border-white/5 bg-canvas">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            selectedId={selectedNode?.meta?.id}
            onSelect={handleSelect}
          />
        </div>
      ) : (
        <FlowDataTable
          nodes={nodes}
          edges={edges}
          showNodes={true}
          selectedId={selectedNode?.meta?.id}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
