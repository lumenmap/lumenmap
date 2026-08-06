"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyableAddress } from "@/components/dashboard/CopyableAddress";
import { StellarExpertLink } from "@/components/dashboard/StellarExpertLink";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { isEligibleAddress } from "@/lib/clipboard";
import { formatNumber, formatPercent } from "@/lib/utils";

export function DetailPanel() {
  const { selectedNode, setSelectedNode, data, metric, isLoading } =
    useDashboard();

  if (isLoading) {
    return (
      <Card className="h-full" aria-busy="true">
        <CardHeader>
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedNode) {
    return (
      /* On mobile the empty state is compact so it doesn't push KPIs far down.
         On xl screens it stretches to fill the sidebar column (h-full). */
      <Card className="xl:h-full">
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

  const address = selectedNode.meta?.id;

  return (
    <Card className="xl:h-full">
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
            <p className="text-xs text-zinc-500">
              {metric === "txn"
                ? "Transactions"
                : metric === "xlm_volume"
                ? "XLM volume"
                : metric === "usdc"
                  ? "USDC volume"
                  : "Activity count"}
            </p>
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

        {address ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">
              {isEligibleAddress(address, selectedNode.meta?.type)
                ? "Address"
                : "ID"}
            </p>
            <CopyableAddress
              address={address}
              type={selectedNode.meta?.type}
            />
            <StellarExpertLink
              address={address}
              type={selectedNode.meta?.type}
            />
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

        {selectedNode.meta?.coverage ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-xs font-semibold text-zinc-400">
              Top-N Coverage
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Coverage</span>
                <span className="text-xs font-medium text-white">
                  {formatPercent(selectedNode.meta.coverage.coveragePercent)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Named entities</span>
                <span className="text-xs font-medium text-white">
                  {selectedNode.meta.coverage.namedEntityCount}{" "}
                  of {selectedNode.meta.coverage.configuredLimit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Named ops</span>
                <span className="text-xs font-medium text-white">
                  {formatNumber(selectedNode.meta.coverage.namedChildValue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Total ops</span>
                <span className="text-xs font-medium text-white">
                  {formatNumber(selectedNode.meta.coverage.parentValue)}
                </span>
              </div>
            </div>
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
