"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { ChevronRight } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";
import type { SelectedNode, TreemapNode } from "@/lib/types";
import { formatNumber, formatPercent, truncateAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface D3TreemapProps {
  root: TreemapNode;
  onSelect: (node: SelectedNode) => void;
}

interface LayoutNode extends HierarchyNode<TreemapNode> {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function resolveColor(node: TreemapNode): string {
  if (node.color) {
    return node.color;
  }

  const category = node.meta?.category;
  if (category && CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }

  return CATEGORY_COLORS.other;
}

function getNodeValue(node: TreemapNode): number {
  return node.value ?? node.meta?.opCount ?? 0;
}

export function D3Treemap({ root, onSelect }: D3TreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 480 });
  const [path, setPath] = useState<TreemapNode[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const currentNode = path.length > 0 ? path[path.length - 1] : root;
  const levelTotal = useMemo(() => {
    const children = currentNode.children ?? [];
    if (children.length > 0) {
      const childSum = children.reduce(
        (sum, child) => sum + getNodeValue(child),
        0,
      );
      if (childSum > 0) {
        return childSum;
      }
    }
    return getNodeValue(currentNode);
  }, [currentNode]);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setSize({
        width: Math.max(Math.floor(width), 320),
        height: Math.max(Math.floor(height), 280),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(
    () =>
      (currentNode.children ?? []).map((child) => ({
        key: child.id ?? child.meta?.id ?? child.name,
        tile: { ...child, children: undefined } as TreemapNode,
        original: child,
      })),
    [currentNode],
  );

  const layoutRoot = useMemo(() => {
    const layoutData: TreemapNode = {
      name: currentNode.name,
      children: tiles.map((entry) => ({
        ...entry.tile,
        id: entry.key,
      })),
    };

    const rootHierarchy = hierarchy(layoutData, (node) => node.children)
      .sum((node) => getNodeValue(node))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    treemap<TreemapNode>()
      .tile(treemapSquarify.ratio(1))
      .size([size.width, size.height])
      .paddingInner(4)
      .paddingOuter(6)
      .round(true)(rootHierarchy);

    return rootHierarchy;
  }, [currentNode.name, size.height, size.width, tiles]);

  const tileLookup = useMemo(
    () => new Map(tiles.map((entry) => [entry.key, entry.original])),
    [tiles],
  );

  const leaves = layoutRoot.leaves() as LayoutNode[];

  const handleNodeClick = useCallback(
    (node: HierarchyNode<TreemapNode>) => {
      const data = node.data;
      const original = tileLookup.get(data.id ?? data.name) ?? data;
      const value = node.value ?? 0;
      const share = levelTotal > 0 ? (value / levelTotal) * 100 : 0;

      onSelect({
        name: data.name,
        value,
        share,
        meta: {
          ...original.meta,
          type: original.meta?.type ?? "entity",
          id: original.meta?.id ?? original.id,
          opCount: value,
          childCount: original.children?.length ?? original.meta?.childCount,
        },
      });

      if (original.children && original.children.length > 0) {
        setPath((current) => [...current, original]);
      }
    },
    [levelTotal, onSelect, tileLookup],
  );

  const navigateTo = (index: number) => {
    if (index < 0) {
      setPath([]);
      return;
    }
    setPath((current) => current.slice(0, index + 1));
  };

  const breadcrumbs = [root, ...path];

  return (
    <div ref={containerRef} className="flex h-full min-h-0 w-full flex-col">
      {/* Breadcrumb nav — min-h-[44px] ensures the row meets touch target height.
          Each Button uses size="sm" which is already h-11 (44px). The shrink-0
          prevents the row from compressing on small containers. */}
      <nav
        aria-label="Treemap navigation"
        className="mb-2 flex min-h-[44px] shrink-0 flex-wrap items-center gap-0.5 text-xs text-zinc-400"
      >
        {breadcrumbs.map((crumb, index) => (
          <div key={`${crumb.name}-${index}`} className="flex items-center">
            {index > 0 ? (
              <ChevronRight
                className="h-3 w-3 shrink-0 text-zinc-600"
                aria-hidden="true"
              />
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-xs text-zinc-300 hover:text-white"
              onClick={() => navigateTo(index - 1)}
              aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}
            >
              {crumb.name}
            </Button>
          </div>
        ))}
      </nav>

      <div ref={chartRef} className="min-h-0 flex-1">
        <svg
          width={size.width}
          height={size.height}
          className="block overflow-hidden rounded-lg"
          role="img"
          aria-label="Network activity treemap"
        >
        {leaves.map((node) => {
          const width = node.x1 - node.x0;
          const height = node.y1 - node.y0;
          const data = node.data;
          const original = tileLookup.get(data.id ?? data.name) ?? data;
          const value = node.value ?? 0;
          const share = levelTotal > 0 ? (value / levelTotal) * 100 : 0;
          const color = resolveColor(data);
          const nodeId = `${data.id ?? data.name}-${node.x0}-${node.y0}`;
          const isHovered = hoveredId === nodeId;
          const identity = original.meta?.id ?? original.id;
          const showLabel = width > 72 && height > 44;
          const showIdentity =
            Boolean(identity) && width > 100 && height > 72 && showLabel;
          const showValue = width > 110 && height > (showIdentity ? 88 : 64);

          const canDrill = Boolean(original?.children?.length);

          // Tiles smaller than 44px in either dimension cannot be accurately tapped
          // on touch screens. They still have a <title> for pointer tooltip.
          // We also add role, tabIndex, and aria-label so keyboard and assistive
          // technology users can reach and activate them regardless of size.
          const ariaLabel = identity
            ? `${data.name}, ${identity}, ${formatNumber(value)} ops, ${formatPercent(share)}`
            : `${data.name}, ${formatNumber(value)} ops, ${formatPercent(share)}`;

          return (
            <g
              key={nodeId}
              transform={`translate(${node.x0},${node.y0})`}
              onMouseEnter={() => setHoveredId(nodeId)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleNodeClick(node)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleNodeClick(node);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={ariaLabel}
              style={{ cursor: canDrill ? "zoom-in" : "pointer" }}
              className="focus-visible:outline-none focus-visible:[&>rect]:stroke-white focus-visible:[&>rect]:stroke-2"
            >
              <rect
                width={width}
                height={height}
                fill={color}
                stroke={isHovered ? "#ffffff" : "#0B0E14"}
                strokeWidth={isHovered ? 2 : 1.5}
                rx={6}
                opacity={isHovered ? 1 : 0.92}
              />
              {showLabel ? (
                <text
                  x={10}
                  y={18}
                  fill="#ffffff"
                  fontSize={showValue ? 14 : 12}
                  fontWeight={700}
                  pointerEvents="none"
                >
                  {width < 130 && data.name.length > 14
                    ? `${data.name.slice(0, 12)}…`
                    : data.name}
                </text>
              ) : null}
              {showIdentity && identity ? (
                <text
                  x={10}
                  y={34}
                  fill="rgba(255,255,255,0.65)"
                  fontSize={10}
                  fontFamily="monospace"
                  pointerEvents="none"
                >
                  {truncateAddress(identity, 5)}
                </text>
              ) : null}
              {showValue ? (
                <>
                  <text
                    x={10}
                    y={showIdentity ? 52 : 42}
                    fill="rgba(255,255,255,0.9)"
                    fontSize={13}
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    {formatNumber(value)}
                  </text>
                  <text
                    x={10}
                    y={showIdentity ? 70 : 60}
                    fill="rgba(255,255,255,0.65)"
                    fontSize={11}
                    pointerEvents="none"
                  >
                    {formatPercent(share)}
                  </text>
                </>
              ) : null}
              {/* <title> provides tooltip on pointer hover and is read by screen readers
                  as a fallback description for tiles that are too small to display text */}
              <title>
                {identity
                  ? `${data.name}\n${identity}\n${formatNumber(value)} ops · ${formatPercent(share)}`
                  : `${data.name}\n${formatNumber(value)} ops · ${formatPercent(share)}`}
              </title>
            </g>
          );
        })}
        </svg>
      </div>
    </div>
  );
}
