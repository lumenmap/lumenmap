"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { ChevronRight } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";
import { PATTERN_DEFS, PATTERN_OPACITY, getCategoryPatternId } from "@/lib/treemap-patterns";
import type { SelectedNode, TreemapNode } from "@/lib/types";
import { formatNumber, formatPercent, truncateAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

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
  const [size, setSize] = useState({ width: 400, height: 400 });
  const [path, setPath] = useState<TreemapNode[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string) => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }
    setAnnouncement("");
    announcementTimeoutRef.current = setTimeout(() => {
      setAnnouncement(message);
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);
  const { metric } = useDashboard();
  const metricUnit =
    metric === "xlm_volume" ? "XLM" : metric === "usdc" ? "USDC" : "ops";
  const metricUnitSuffix = metric === "ops" ? "" : metricUnit;

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

    const { width, height } = element.getBoundingClientRect();
    setSize({
      width: Math.floor(width),
      height: Math.floor(height),
    });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setSize({
        width: Math.max(Math.floor(width), 200),
        height: Math.max(Math.floor(height), 200),
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

      const childCount = original.children?.length ?? original.meta?.childCount ?? 0;
      const childrenText =
        childCount > 0 ? `${childCount} children available` : "no children";
      const selectionText = `Selected ${data.name}. Level ${path.length + 1}. Value: ${formatNumber(value)} operations (${formatPercent(share)} share of level). Available children: ${childrenText}.`;

      if (original.children && original.children.length > 0) {
        const newPath = [root, ...path, original];
        const pathString = newPath.map((n) => n.name).join(" > ");
        announce(`${selectionText} Drilled down. New path: ${pathString}.`);
        setPath((current) => [...current, original]);
      } else {
        announce(selectionText);
      }
    },
    [levelTotal, onSelect, tileLookup, path, root, announce],
  );

  const navigateTo = useCallback(
    (index: number) => {
      let targetNode: TreemapNode;
      let newPath: TreemapNode[];
      if (index < 0) {
        targetNode = root;
        newPath = [root];
      } else {
        targetNode = path[index];
        newPath = [root, ...path.slice(0, index + 1)];
      }

      const value = getNodeValue(targetNode);
      const level = index < 0 ? 0 : index + 1;
      const childCount =
        targetNode.children?.length ?? targetNode.meta?.childCount ?? 0;
      const pathString = newPath.map((n) => n.name).join(" > ");
      const childrenText =
        childCount > 0 ? `${childCount} children available` : "no children";

      announce(
        `Navigated to ${targetNode.name} via breadcrumbs. Level ${level}. Value: ${formatNumber(value)} operations. Current path: ${pathString}. Available children: ${childrenText}.`,
      );

      if (index < 0) {
        setPath([]);
        return;
      }
      setPath((current) => current.slice(0, index + 1));
    },
    [root, path, announce],
  );

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
              data-testid="treemap-breadcrumb"
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
        <style>{`
          g[tabindex]:focus-visible { outline: none; }
          g[tabindex]:focus-visible .focus-ring { display: block; }
          g[tabindex]:focus-visible .tile-rect {
            stroke: #0B0E14 !important;
            stroke-width: 2.5 !important;
            opacity: 1 !important;
          }
          .focus-ring { display: none; }
        `}</style>
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
          const isFocused = focusedId === nodeId;
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
            ? `${data.name}, ${identity}, ${formatNumber(value)} ${metricUnit}, ${formatPercent(share)}`
            : `${data.name}, ${formatNumber(value)} ${metricUnit}, ${formatPercent(share)}`;

          return (
            <g
              key={nodeId}
              data-testid="treemap-tile"
              data-node-name={data.name}
              transform={`translate(${node.x0},${node.y0})`}
              tabIndex={0}
              role="button"
              aria-label={ariaLabel}
              onMouseEnter={() => setHoveredId(nodeId)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setFocusedId(nodeId)}
              onBlur={() => setFocusedId(null)}
              onClick={() => handleNodeClick(node)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleNodeClick(node);
                }
              }}
              style={{ cursor: canDrill ? "zoom-in" : "pointer" }}
              className="focus-visible:outline-none"
            >
              <rect
                className="focus-ring"
                x={-2.5}
                y={-2.5}
                width={width + 5}
                height={height + 5}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2}
                rx={8.5}
                pointerEvents="none"
              />
              <rect
                className="tile-rect"
                width={width}
                height={height}
                fill={color}
                stroke={isHovered || isFocused ? "#ffffff" : "#0B0E14"}
                strokeWidth={isHovered || isFocused ? 2 : 1.5}
                rx={6}
                opacity={isHovered || isFocused ? 1 : 0.92}
              />
              {(() => {
                const patternId = getCategoryPatternId(data.meta?.category);
                return patternId ? (
                  <rect
                    width={width}
                    height={height}
                    rx={6}
                    fill={`url(#${patternId})`}
                    opacity={PATTERN_OPACITY}
                    pointerEvents="none"
                  />
                ) : null;
              })()}
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
                    {formatNumber(value)} {metricUnitSuffix}
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
                  ? `${data.name}\n${identity}\n${formatNumber(value)} ${metricUnit} · ${formatPercent(share)}`
                  : `${data.name}\n${formatNumber(value)} ${metricUnit} · ${formatPercent(share)}`}
                {original.meta?.coverage
                  ? `\nCoverage: ${formatPercent(original.meta.coverage.coveragePercent)} (${formatNumber(original.meta.coverage.namedChildValue)} of ${formatNumber(original.meta.coverage.parentValue)}) · ${original.meta.coverage.namedEntityCount} entities · limit ${original.meta.coverage.configuredLimit}`
                  : ""}
              </title>
            </g>
          );
        })}
        </svg>
      </div>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
    </div>
  );
}