"use client";

import { useEffect, useMemo, useRef } from "react";
import type { FlowTableEdge, FlowTableNode } from "./FlowDataTable";
import { layoutFlow } from "@/lib/flow/layout";

const COLORS: Record<string, string> = {
  exchange: "#f59e0b",
  wallet: "#14b8a6",
  anchor: "#3b82f6",
  defi: "#7b61ff",
};

export function FlowCanvas({ nodes, edges }: {
  nodes: readonly FlowTableNode[];
  edges: readonly FlowTableEdge[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positioned = useMemo(() => layoutFlow(nodes, edges), [nodes, edges]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const radius = Math.min(28, Math.max(18, width / 26));
      const inset = radius + 28;
      const point = (node: typeof positioned[number]) => ({
        x: inset + node.x * Math.max(0, width - inset * 2),
        y: inset + node.y * Math.max(0, height - inset * 2),
      });
      const byId = new Map(positioned.map((node) => [node.id, node]));

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#8d8e98";
      ctx.fillStyle = "#8d8e98";
      for (const edge of edges) {
        const source = byId.get(edge.source);
        const target = byId.get(edge.destination);
        if (!source || !target || source === target) continue;
        const a = point(source);
        const b = point(target);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius * 2) continue;
        const ux = dx / distance;
        const uy = dy / distance;
        const endX = b.x - ux * (radius + 5);
        const endY = b.y - uy * (radius + 5);
        ctx.beginPath();
        ctx.moveTo(a.x + ux * radius, a.y + uy * radius);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - ux * 10 - uy * 5, endY - uy * 10 + ux * 5);
        ctx.lineTo(endX - ux * 10 + uy * 5, endY - uy * 10 - ux * 5);
        ctx.closePath();
        ctx.fill();
      }

      ctx.textAlign = "center";
      ctx.font = "12px sans-serif";
      for (const node of positioned) {
        const { x, y } = point(node);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[node.category ?? ""] ?? "#6b7280";
        ctx.fill();
        ctx.strokeStyle = "#f4f4f5";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#f4f4f5";
        ctx.fillText(node.label, x, y + radius + 17, Math.max(90, width / 5));
      }
    };

    draw();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(draw) : null;
    if (observer) observer.observe(canvas);
    return () => observer?.disconnect();
  }, [positioned, edges]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Flow graph with ${nodes.length} accounts and ${edges.length} directed connections`}
      data-testid="flow-canvas"
      data-node-count={nodes.length}
      data-edge-count={edges.length}
      className="block h-[420px] w-full max-w-full sm:h-[520px]"
    />
  );
}
