"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceLink, forceManyBody, forceSimulation, forceCenter, type SimulationNodeDatum, type SimulationLinkDatum } from "d3-force";
import { CATEGORY_COLORS, GROUP_LABELS } from "@/lib/constants";
import { formatNumber, truncateAddress, useReducedMotion } from "@/lib/utils";
import type { FlowTableNode, FlowTableEdge } from "./FlowDataTable";

interface FlowCanvasProps {
  nodes: readonly FlowTableNode[];
  edges: readonly FlowTableEdge[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

interface FlowNode extends SimulationNodeDatum, FlowTableNode {
  activity: number; // op_count or volume per ADR
  radius: number;
}

interface FlowLink extends SimulationLinkDatum<FlowNode> {
  source: FlowNode;
  target: FlowNode;
  amount: string;
  operationCount: number;
}

const MIN_RADIUS = 8;
const MAX_RADIUS = 32;
const DEFAULT_RADIUS = 16;

// Calculate node activity (inflow + outflow operations)
function calculateNodeActivity(nodeId: string, edges: readonly FlowTableEdge[]): number {
  let activity = 0;
  for (const edge of edges) {
    if (edge.source === nodeId) activity += edge.operationCount;
    if (edge.destination === nodeId) activity += edge.operationCount;
  }
  return activity;
}

// Map activity to radius within clamped range
function mapActivityToRadius(activity: number, minActivity: number, maxActivity: number): number {
  if (maxActivity === minActivity) return DEFAULT_RADIUS;
  const normalized = (activity - minActivity) / (maxActivity - minActivity);
  return MIN_RADIUS + normalized * (MAX_RADIUS - MIN_RADIUS);
}

// Resolve node color based on category
function resolveNodeColor(category?: string): string {
  if (!category) return CATEGORY_COLORS.other;
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
}

export function FlowCanvas({ nodes, edges, selectedId, onSelect }: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  // Calculate activity for all nodes
  const nodeActivity = useMemo(() => {
    const activityMap = new Map<string, number>();
    for (const node of nodes) {
      activityMap.set(node.id, calculateNodeActivity(node.id, edges));
    }
    return activityMap;
  }, [nodes, edges]);

  // Get min/max activity for scaling
  const { minActivity, maxActivity } = useMemo(() => {
    const activities = Array.from(nodeActivity.values());
    return {
      minActivity: Math.min(...activities),
      maxActivity: Math.max(...activities),
    };
  }, [nodeActivity]);

  // Prepare nodes with activity and radius
  const flowNodes: FlowNode[] = useMemo(() => {
    const getPseudoRandom = (seed: string) => {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
      }
      const x = Math.sin(hash) * 10000;
      return x - Math.floor(x);
    };

    return nodes.map((node) => ({
      ...node,
      x: getPseudoRandom(node.id + "x") * size.width,
      y: getPseudoRandom(node.id + "y") * size.height,
      activity: nodeActivity.get(node.id) ?? 0,
      radius: mapActivityToRadius(nodeActivity.get(node.id) ?? 0, minActivity, maxActivity),
    }));
  }, [nodes, nodeActivity, minActivity, maxActivity, size.width, size.height]);

  // Prepare links
  const flowLinks: FlowLink[] = useMemo(() => {
    const nodeMap = new Map(flowNodes.map((n) => [n.id, n]));
    return edges
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.destination);
        if (!source || !target) return null;
        return {
          source,
          target,
          amount: edge.amount,
          operationCount: edge.operationCount,
        };
      })
      .filter((link): link is FlowLink => link !== null);
  }, [edges, flowNodes]);

  // Setup simulation
  useEffect(() => {
    if (flowNodes.length === 0 || !svgRef.current) return;

    const simulation = forceSimulation<FlowNode>(flowNodes)
      .force("link", forceLink<FlowNode, FlowLink>(flowLinks).id((d) => d.id).distance(100))
      .force("charge", forceManyBody<FlowNode>().strength(-300))
      .force("center", forceCenter(size.width / 2, size.height / 2));

    if (reducedMotion) {
      simulation.stop();
    }

    const svg = svgRef.current;
    const updatePositions = () => {
      const nodeElements = svg.querySelectorAll<SVGGElement>(".flow-node");
      const linkElements = svg.querySelectorAll<SVGLineElement>(".flow-link");

      nodeElements.forEach((el) => {
        const node = flowNodes.find((n) => n.id === el.dataset.id);
        if (node) {
          el.setAttribute("transform", `translate(${node.x ?? 0},${node.y ?? 0})`);
        }
      });

      linkElements.forEach((el) => {
        const sourceId = el.dataset.source;
        const targetId = el.dataset.target;
        const source = flowNodes.find((n) => n.id === sourceId);
        const target = flowNodes.find((n) => n.id === targetId);
        if (source && target) {
          el.setAttribute("x1", String(source.x ?? 0));
          el.setAttribute("y1", String(source.y ?? 0));
          el.setAttribute("x2", String(target.x ?? 0));
          el.setAttribute("y2", String(target.y ?? 0));
        }
      });
    };

    simulation.on("tick", updatePositions);

    return () => {
      simulation.stop();
    };
  }, [flowNodes, flowLinks, size, reducedMotion]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({
        width: Math.max(Math.floor(width), 400),
        height: Math.max(Math.floor(height), 400),
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      onSelect?.(nodeId);
    },
    [onSelect],
  );

  const handleNodeMouseEnter = useCallback((nodeId: string) => {
    setHoveredId(nodeId);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredId(null);
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-lg bg-canvas">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="block"
        role="img"
        aria-label="Flow graph visualization"
      >
        {/* Links */}
        {flowLinks.map((link, index) => (
          <line
            key={`link-${index}`}
            className="flow-link"
            data-source={link.source.id}
            data-target={link.target.id}
            x1={link.source.x ?? 0}
            y1={link.source.y ?? 0}
            x2={link.target.x ?? 0}
            y2={link.target.y ?? 0}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={1.5}
          />
        ))}

        {/* Nodes */}
        {flowNodes.map((node) => {
          const isSelected = selectedId === node.id;
          const isHovered = hoveredId === node.id;
          const color = resolveNodeColor(node.category);
          const radius = node.radius;

          return (
            <g
              key={node.id}
              className="flow-node"
              data-id={node.id}
              transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
              onClick={() => handleNodeClick(node.id)}
              onMouseEnter={() => handleNodeMouseEnter(node.id)}
              onMouseLeave={handleNodeMouseLeave}
              style={{ cursor: "pointer" }}
            >
              {/* Node circle */}
              <circle
                r={radius}
                fill={color}
                stroke={isSelected || isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.2)"}
                strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                opacity={reducedMotion ? 1 : isHovered ? 1 : 0.9}
              />
              {/* Node label (only shown for larger nodes) */}
              {radius > 12 && (
                <text
                  x={0}
                  y={radius + 14}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={500}
                  pointerEvents="none"
                >
                  {node.label.length > 10 ? `${node.label.slice(0, 8)}…` : node.label}
                </text>
              )}
              {/* Tooltip */}
              <title>
                {node.label}
                {node.category ? ` (${GROUP_LABELS[node.category] || node.category})` : ""}
                {"\n"}
                Activity: {formatNumber(node.activity)} operations
                {"\n"}
                ID: {truncateAddress(node.id, 8)}
              </title>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <FlowLegend />
    </div>
  );
}

function FlowLegend() {
  const categories = Object.entries(GROUP_LABELS).map(([key, label]) => ({
    key,
    label,
    color: CATEGORY_COLORS[key],
  }));

  return (
    <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-black/80 p-3 text-xs shadow-xl backdrop-blur-sm">
      <div className="mb-2 font-semibold text-white">Node Size</div>
      <div className="mb-3 flex items-center gap-2 text-zinc-400">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-white/20" />
          <span>Low activity</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-5 w-5 rounded-full bg-white/20" />
          <span>High activity</span>
        </div>
      </div>
      <div className="mb-2 font-semibold text-white">Color by Category</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {categories.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-2 text-zinc-300">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
