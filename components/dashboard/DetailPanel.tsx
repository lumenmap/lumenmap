"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { formatNumber, formatPercent } from "@/lib/utils";

export function DetailPanel() {
  const { selectedNode, setSelectedNode, data } = useDashboard();

  if (!selectedNode) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Select a treemap tile to view operation volume, category, and
            identity details.
          </p>
        </CardContent>
      </Card>
    );
  }

  const periodLabel =
    data?.period === "1d"
      ? "Today"
      : data?.period === "7d"
        ? "Last 7 days"
        : data?.period === "30d"
          ? "Last 30 days"
          : "This month";

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle className="text-base text-white">
            {selectedNode.name}
          </CardTitle>
          {selectedNode.meta?.category ? (
            <Badge variant="secondary">{selectedNode.meta.category}</Badge>
          ) : null}
        </div>
        {/* size="icon" gives a 44×44 hit area (h-11 w-11) to meet touch target requirements */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setSelectedNode(null)}
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-zinc-500">Operations</p>
            <p className="text-lg font-semibold text-white">
              {formatNumber(selectedNode.value)}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-zinc-500">Share (current level)</p>
            <p className="text-lg font-semibold text-white">
              {formatPercent(selectedNode.share)}
            </p>
          </div>
        </div>

        {selectedNode.meta?.protocol ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Protocol</p>
            <p className="text-sm text-zinc-200">{selectedNode.meta.protocol}</p>
          </div>
        ) : null}

        {selectedNode.meta?.id ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Address</p>
            <p className="break-all font-mono text-xs text-zinc-300">
              {selectedNode.meta.id}
            </p>
          </div>
        ) : null}

        {selectedNode.meta?.eventType ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">
              {selectedNode.meta.category === "soroban"
                ? "Contract function"
                : "Operation type"}
            </p>
            <p className="font-mono text-xs text-zinc-300">
              {selectedNode.meta.eventType}
            </p>
          </div>
        ) : null}

        {selectedNode.meta?.childCount ? (
          <p className="text-xs text-stellar-light">
            Click this tile again in the treemap to explore{" "}
            {selectedNode.meta.childCount} sub-items.
          </p>
        ) : null}

        <div>
          <p className="mb-1 text-xs text-zinc-500">Period</p>
          <p className="text-sm text-zinc-200">{periodLabel}</p>
        </div>
      </CardContent>
    </Card>
  );
}
