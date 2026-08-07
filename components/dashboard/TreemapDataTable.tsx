"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getNodeValue } from "@/lib/entities/treemap-level";
import type { SelectedNode, TreemapNode } from "@/lib/types";
import { cn, formatExactNumber, formatPercent } from "@/lib/utils";

interface TreemapDataTableProps {
  levelName: string;
  nodes: TreemapNode[];
  levelTotal: number;
  selectedNode: SelectedNode | null;
  onSelect: (node: SelectedNode | null) => void;
}

type SortKey = "name" | "type" | "value" | "share";
type SortDirection = "asc" | "desc";

const TYPE_LABELS: Record<string, string> = {
  root: "Root",
  category: "Category",
  entity: "Operation type",
  contract: "Contract",
  account: "Account",
};

const UNIT_LABEL = "ops";

function getNodeIdentity(node: TreemapNode): string {
  return node.meta?.id ?? node.id ?? node.name;
}

function getNodeType(node: TreemapNode): string {
  return TYPE_LABELS[node.meta?.type ?? ""] ?? "Other";
}

function getCoverageLabel(node: TreemapNode): string {
  const childCount = node.children?.length ?? node.meta?.childCount;
  if (childCount) {
    return `${childCount} sub-item${childCount === 1 ? "" : "s"}`;
  }
  return "Leaf";
}

function toSelectedNode(node: TreemapNode, share: number): SelectedNode {
  return {
    name: node.name,
    value: getNodeValue(node),
    share,
    meta: {
      ...node.meta,
      type: node.meta?.type ?? "entity",
      id: node.meta?.id ?? node.id,
      opCount: getNodeValue(node),
      childCount: node.children?.length ?? node.meta?.childCount,
    },
  };
}

function SortableHeader({
  label,
  sortByKey,
  ariaSortValue,
  onSort,
  sortIcon,
}: {
  label: string;
  sortByKey: SortKey;
  ariaSortValue: "ascending" | "descending" | "none";
  onSort: (key: SortKey) => void;
  sortIcon: ReactNode;
}) {
  return (
    <th scope="col" aria-sort={ariaSortValue} className="p-0">
      <button
        type="button"
        onClick={() => onSort(sortByKey)}
        className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light"
      >
        {label}
        {sortIcon}
      </button>
    </th>
  );
}

export function TreemapDataTable({
  levelName,
  nodes,
  levelTotal,
  selectedNode,
  onSelect,
}: TreemapDataTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows = useMemo(() => {
    const withShare = nodes.map((node) => {
      const value = getNodeValue(node);
      const share = levelTotal > 0 ? (value / levelTotal) * 100 : 0;
      return { node, value, share };
    });

    return [...withShare].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") {
        comparison = a.node.name.localeCompare(b.node.name);
      } else if (sortKey === "type") {
        comparison = getNodeType(a.node).localeCompare(getNodeType(b.node));
      } else if (sortKey === "value") {
        comparison = a.value - b.value;
      } else {
        comparison = a.share - b.share;
      }

      if (comparison === 0) {
        comparison = a.node.name.localeCompare(b.node.name);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [nodes, levelTotal, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" => {
    if (key !== sortKey) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  const renderSortIcon = (key: SortKey) => {
    if (key !== sortKey) {
      return <ArrowUpDown className="h-3 w-3 text-zinc-600" aria-hidden="true" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-white" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3 w-3 text-white" aria-hidden="true" />
    );
  };

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-black/20 p-6 text-center text-sm text-zinc-500">
        No rows to display for {levelName}.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        Exact values for <span className="text-zinc-300">{levelName}</span>{" "}
        ({formatExactNumber(levelTotal)} {UNIT_LABEL} total)
      </p>
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <SortableHeader
                label="Name"
                sortByKey="name"
                ariaSortValue={ariaSort("name")}
                onSort={handleSort}
                sortIcon={renderSortIcon("name")}
              />
              <SortableHeader
                label="Type"
                sortByKey="type"
                ariaSortValue={ariaSort("type")}
                onSort={handleSort}
                sortIcon={renderSortIcon("type")}
              />
              <SortableHeader
                label="Value"
                sortByKey="value"
                ariaSortValue={ariaSort("value")}
                onSort={handleSort}
                sortIcon={renderSortIcon("value")}
              />
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400"
              >
                Unit
              </th>
              <SortableHeader
                label="Share"
                sortByKey="share"
                ariaSortValue={ariaSort("share")}
                onSort={handleSort}
                sortIcon={renderSortIcon("share")}
              />
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400"
              >
                Coverage
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ node, value, share }) => {
              const identity = getNodeIdentity(node);
              const isSelected =
                selectedNode !== null &&
                (selectedNode.meta?.id ?? selectedNode.name) === identity;
              const isSynthetic = node.meta?.synthetic === true;

              return (
                <tr
                  key={identity}
                  className={cn(
                    "border-b border-white/5 last:border-0",
                    isSelected && "bg-white/10",
                    isSynthetic && "italic text-zinc-400",
                  )}
                >
                  <th scope="row" className="p-0 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => onSelect(toSelectedNode(node, share))}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-stellar-light"
                    >
                      {node.name}
                      {isSynthetic && (
                        <Badge variant="secondary" className="text-[10px]">
                          Remainder
                        </Badge>
                      )}
                    </button>
                  </th>
                  <td className="px-3 py-2 text-zinc-400">{getNodeType(node)}</td>
                  <td className="px-3 py-2 font-mono text-zinc-200">
                    {formatExactNumber(value)}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{UNIT_LABEL}</td>
                  <td className="px-3 py-2 text-zinc-300">{formatPercent(share)}</td>
                  <td className="px-3 py-2 text-zinc-500">{getCoverageLabel(node)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
