"use client";

import { X, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { formatNumber, formatPercent } from "@/lib/utils";

function formatUSD(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function getStatusIcon(status: string | undefined) {
  switch (status) {
    case "valid":
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case "partial":
      return <Clock className="h-4 w-4 text-yellow-400" />;
    case "stale":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    default:
      return null;
  }
}

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

  const isProtocol = selectedNode.meta?.type === "protocol";

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
          {isProtocol && selectedNode.meta?.status ? (
            <div className="flex items-center gap-2">
              {getStatusIcon(selectedNode.meta.status)}
              <span className="text-xs text-zinc-400 capitalize">
                {selectedNode.meta.status}
              </span>
            </div>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
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
            <p className="text-xs text-zinc-500">
              {isProtocol ? "TVL (USD)" : "Operations"}
            </p>
            <p className="text-lg font-semibold text-white">
              {isProtocol
                ? formatUSD(selectedNode.value)
                : formatNumber(selectedNode.value)}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-zinc-500">Share (current level)</p>
            <p className="text-lg font-semibold text-white">
              {formatPercent(selectedNode.share)}
            </p>
          </div>
        </div>

        {isProtocol && selectedNode.meta?.tvlUsd ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Total Value Locked</p>
            <p className="text-sm text-zinc-200">
              {formatUSD(selectedNode.meta.tvlUsd)}
            </p>
          </div>
        ) : null}

        {isProtocol && selectedNode.meta?.snapshotTime ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Snapshot Time</p>
            <p className="text-sm text-zinc-200">
              {new Date(selectedNode.meta.snapshotTime).toLocaleString()}
            </p>
          </div>
        ) : null}

        {isProtocol && selectedNode.meta?.confidence ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Data Confidence</p>
            <p className="text-sm text-zinc-200">
              {(selectedNode.meta.confidence * 100).toFixed(0)}%
            </p>
          </div>
        ) : null}

        {isProtocol && selectedNode.meta?.source ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Data Source</p>
            <p className="text-sm text-zinc-200">{selectedNode.meta.source}</p>
          </div>
        ) : null}

        {!isProtocol && selectedNode.meta?.protocol ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Protocol</p>
            <p className="text-sm text-zinc-200">{selectedNode.meta.protocol}</p>
          </div>
        ) : null}

        {!isProtocol && selectedNode.meta?.id ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Address</p>
            <p className="break-all font-mono text-xs text-zinc-300">
              {selectedNode.meta.id}
            </p>
          </div>
        ) : null}

        {!isProtocol && selectedNode.meta?.eventType ? (
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
