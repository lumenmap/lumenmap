"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { FlowCanvas } from "@/components/dashboard/FlowCanvas";
import { FlowDataTable } from "@/components/dashboard/FlowDataTable";
import { FlowSankey } from "@/components/dashboard/FlowSankey";
import { buildSankeyGroups } from "@/lib/flow/sankey";
import type { FlowEdge, FlowNode } from "@/lib/flow/graph";
import type { FlowResponse } from "@/lib/flow/data";

export interface FlowViewSectionProps {
  nodes?: readonly FlowNode[];
  edges?: readonly FlowEdge[];
  sampled?: boolean;
}

export function FlowVisualization({ nodes, edges, sampled = false, onSelect }: {
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
  sampled?: boolean;
  onSelect?: (id: string) => void;
}) {
  const [view, setView] = useState<"graph" | "sankey" | "table">("graph");
  const hasSankey = buildSankeyGroups(edges).length > 0;
  if (edges.length === 0) return <p role="status" className="rounded-xl border border-white/10 p-6 text-sm text-zinc-400">No payment flow edges available for this period.</p>;
  const activeView = view === "sankey" && !hasSankey ? "graph" : view;
  const options: Array<"graph" | "sankey" | "table"> = hasSankey ? ["graph", "sankey", "table"] : ["graph", "table"];
  return <section className="min-w-0 space-y-4" aria-label="Payment flow visualization">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-white">Payment Flow</h2>
      <div role="group" aria-label="Flow view" className="inline-flex flex-wrap rounded-lg border border-white/10 p-0.5">
        {options.map((option) => <button
          key={option} type="button" aria-pressed={activeView === option} onClick={() => setView(option)}
          className={`min-h-[44px] rounded-md px-3 py-1 text-xs font-medium capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light ${activeView === option ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}
        >{option}</button>)}
      </div>
    </div>
    {activeView === "graph" ? <div className="h-[600px] min-w-0 rounded-xl border border-white/5 bg-canvas"><FlowCanvas nodes={nodes} edges={edges} onSelect={onSelect} /></div>
      : activeView === "sankey" ? <FlowSankey nodes={nodes} edges={edges} sampled={sampled} onSelect={onSelect} />
      : <FlowDataTable nodes={nodes} edges={edges} showNodes caption="Payment flow edges" onSelect={onSelect} />}
  </section>;
}

/** The active dashboard Flow card reads payment edges from the existing Flow API. */
export function FlowViewSection({ nodes, edges, sampled }: FlowViewSectionProps) {
  const { period, network, setSelectedNode } = useDashboard();
  const supplied = nodes !== undefined && edges !== undefined;
  const query = useQuery({
    queryKey: ["flow", period, network],
    queryFn: async (): Promise<FlowResponse> => {
      const response = await fetch(`/api/v1/flow?${new URLSearchParams({ period, network })}`);
      if (!response.ok) throw new Error("Failed to load payment flows.");
      return response.json() as Promise<FlowResponse>;
    },
    enabled: !supplied,
  });
  if (!supplied && query.isPending) return <p role="status" className="p-6 text-sm text-zinc-400">Loading payment flows…</p>;
  if (!supplied && query.isError) return <p role="alert" className="p-6 text-sm text-red-200">{query.error.message}</p>;
  const flowNodes = nodes ?? query.data?.nodes ?? [];
  const flowEdges = edges ?? query.data?.edges ?? [];
  const selectNode = (id: string) => {
    const node = flowNodes.find((item) => item.id === id);
    if (node) setSelectedNode({ name: node.label, value: 0, share: 0, meta: { type: "account", id: node.id, category: node.category } });
  };
  return <FlowVisualization nodes={flowNodes} edges={flowEdges} sampled={sampled ?? query.data?.sampled} onSelect={selectNode} />;
}
