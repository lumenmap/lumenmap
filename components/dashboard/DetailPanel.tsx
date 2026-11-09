"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent, type TouchEvent } from "react";
import { cycleFocusWithinSheet, shouldDismissBottomSheetOnSwipe } from "@/lib/ui/detail-bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyableAddress } from "@/components/dashboard/CopyableAddress";
import { EntityNotes } from "@/components/dashboard/EntityNotes";
import { StellarExpertLink } from "@/components/dashboard/StellarExpertLink";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { isEligibleAddress } from "@/lib/clipboard";
import { buildContractFunctionBreakdown } from "@/lib/entities/contract-function-breakdown";
import { ContractFunctionBarChart } from "@/components/dashboard/ContractFunctionBarChart";
import { ResearchNoteEditor } from "@/components/dashboard/ResearchNoteEditor";
import { resolveWatchlistKind } from "@/lib/watchlist";
import { getMetricUnit } from "@/lib/metrics/units";
import { formatNumber, formatPercent } from "@/lib/utils";
import { formatEntityAge, formatFirstSeen, type FirstSeenContext } from "@/lib/entities/first-seen";

function FirstSeenDetails({ id, type, network }: {
  id: string;
  type: "account" | "contract";
  network: "mainnet" | "testnet";
}) {
  const { data, isPending } = useQuery<FirstSeenContext>({
    queryKey: ["first-seen", network, type, id],
    queryFn: async () => {
      const params = new URLSearchParams({ id, type, network });
      const response = await fetch(`/api/v1/entities/first-seen?${params}`);
      if (!response.ok) throw new Error("First-seen lookup failed");
      return response.json() as Promise<FirstSeenContext>;
    },
    retry: false,
    staleTime: 15 * 60_000,
  });
  const value = isPending ? "Loading…" : formatFirstSeen(data?.firstSeenAt ?? null);
  const age = isPending ? "Loading…" : formatEntityAge(data?.firstSeenAt ?? null);
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-xs text-zinc-500">First seen</p><p className="text-sm text-zinc-200">{value}</p></div>
        <div><p className="text-xs text-zinc-500">Age</p><p className="text-sm text-zinc-200">{age}</p></div>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Approximate age since earliest observed activity, not account or contract creation. Hubble data may lag.
      </p>
    </div>
  );
}

export function DetailPanel({ onViewFlow }: { onViewFlow?: (account: string) => void }) {
  const {
    selectedNode,
    setSelectedNode,
    data,
    metric,
    isLoading,
    network,
    setTreemapView,
    setActiveLevelPath,
    readOnly,
  } = useDashboard();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1280) {
      document
        .getElementById("detail-panel-container")
        ?.scrollIntoView({ behavior: "smooth" });
    }
    const nodeId = selectedNode?.meta?.nodeId;
    return () => {
      if (nodeId) {
        setTimeout(() => {
          document.getElementById(`node-${nodeId}`)?.focus();
        }, 0);
      }
    };
  }, [selectedNode?.meta?.nodeId]);

  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedNode || typeof window === "undefined") return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedNode(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNode, setSelectedNode]);

  const handleSheetKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setSelectedNode(null);
      return;
    }
    if (event.key !== "Tab" || !sheetRef.current) return;
    const focusables = Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusables.length === 0) return;
    const currentIndex = focusables.indexOf(
      document.activeElement as HTMLElement,
    );
    const nextIndex = cycleFocusWithinSheet(
      focusables.length,
      currentIndex,
      event.shiftKey,
    );
    if (
      (event.shiftKey && currentIndex <= 0) ||
      (!event.shiftKey && currentIndex === focusables.length - 1)
    ) {
      event.preventDefault();
      focusables[nextIndex]?.focus();
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY ?? null;
    touchStartYRef.current = null;
    if (
      startY !== null &&
      endY !== null &&
      shouldDismissBottomSheetOnSwipe(startY, endY)
    ) {
      setSelectedNode(null);
    }
  };

  const contractId =
    selectedNode?.meta?.type === "contract" ? selectedNode.meta.id : undefined;

  const functionBreakdown = useMemo(
    () =>
      buildContractFunctionBreakdown(
        data?.treemaps.events,
        contractId ?? "",
      ),
    [data?.treemaps.events, data?.period, metric, contractId],
  );

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
    return null;
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
  const opsUnitLabel = getMetricUnit("ops").unitLabel;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-panel-title"
      data-testid="detail-bottom-sheet"
      onKeyDown={handleSheetKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] max-w-full overflow-x-hidden overflow-y-auto rounded-t-2xl border-t border-white/15 bg-zinc-950/95 shadow-2xl transition-transform duration-200 motion-reduce:transition-none xl:static xl:z-auto xl:max-h-none xl:rounded-none xl:border-0 xl:bg-transparent xl:shadow-none"
    >
      <div
        aria-hidden="true"
        className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/20 xl:hidden"
      />
      <Card className="max-w-full overflow-x-hidden xl:h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle id="detail-panel-title" data-testid="detail-title" className="text-base text-white">
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
              {metric === "xlm_volume"
                ? "XLM volume"
                : metric === "usdc"
                  ? "USDC volume"
                  : metric === "transactions"
                    ? "Transaction count"
                    : metric === "protocol_tvl"
                      ? "TVL (USD)"
                      : selectedNode.meta?.assetCode
                        ? `${selectedNode.meta.assetCode} volume`
                        : "Activity count"}
            </p>
            <p
              data-testid="detail-operations"
              className="text-lg font-semibold text-white"
            >
              {metric === "protocol_tvl"
                ? `$${formatNumber(selectedNode.meta?.tvlUsd ?? selectedNode.value)}`
                : (selectedNode.meta?.assetAmount ??
                  formatNumber(selectedNode.value))}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-zinc-500">Share (current level)</p>
            <p
              data-testid="detail-share"
              className="text-lg font-semibold text-white"
            >
              {formatPercent(selectedNode.share)}
            </p>
          </div>
        </div>

        {selectedNode.meta?.adapterStatusLabel ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="mb-1 text-xs text-zinc-500">Adapter status</p>
            <p className="text-sm text-zinc-200">
              {selectedNode.meta.adapterStatusLabel}
            </p>
            {selectedNode.meta.snapshotTime ? (
              <p className="mt-1 font-mono text-xs text-zinc-500">
                Snapshot: {selectedNode.meta.snapshotTime}
              </p>
            ) : null}
          </div>
        ) : null}

        {selectedNode.meta?.protocol ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Protocol</p>
            <p data-testid="detail-protocol" className="text-sm text-zinc-200">
              {selectedNode.meta.protocol}
            </p>
          </div>
        ) : null}

        {selectedNode.meta?.assetCode ? (
          <div className="space-y-2">
            <div>
              <p className="text-xs text-zinc-500">Asset code</p>
              <p className="font-mono text-sm text-zinc-200">
                {selectedNode.meta.assetCode}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Issuer</p>
              <p className="break-all font-mono text-xs text-zinc-300">
                {selectedNode.meta.assetIssuer ?? "Native"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Payment operations</p>
              <p className="text-sm text-zinc-200">
                {formatNumber(selectedNode.meta.opCount ?? 0)}
              </p>
            </div>
          </div>
        ) : null}

        {address ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">
              {isEligibleAddress(address, selectedNode.meta?.type)
                ? "Address"
                : "ID"}
            </p>
            <CopyableAddress address={address} type={selectedNode.meta?.type} />
            <StellarExpertLink
              address={address}
              type={selectedNode.meta?.type}
            />
            {selectedNode.meta?.type === "account" && onViewFlow && (
              <Button type="button" variant="ghost" size="sm" className="mt-2 text-stellar-light" onClick={() => onViewFlow(address)}>
                View 1-hop flow
              </Button>
            )}
          </div>
        ) : null}

        {address && !readOnly &&
        (selectedNode.meta?.type === "account" || selectedNode.meta?.type === "contract") ? (
          <FirstSeenDetails id={address} type={selectedNode.meta.type} network={network} />
        ) : null}

        {address ? (
          <EntityNotes key={`${network}:${address}`} address={address} network={network} />
        ) : null}

        {selectedNode.meta?.eventType ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">
              {selectedNode.meta.category === "soroban"
                ? "Contract function"
                : "Operation type"}
            </p>
            <p
              data-testid="detail-event-type"
              className="font-mono text-xs text-zinc-300"
            >
              {selectedNode.meta.eventType}
            </p>
          </div>
        ) : null}

        {contractId ? (
          <section
            aria-labelledby="contract-function-breakdown-heading"
            className="rounded-lg border border-white/10 bg-black/20 p-3"
          >
            <h3
              id="contract-function-breakdown-heading"
              className="mb-2 text-xs font-semibold text-zinc-400"
            >
              Top Soroban functions
            </h3>
            {functionBreakdown.rows.length === 0 ? (
              <p className="text-sm text-zinc-400" role="status">
                No host-function breakdown is available for this contract in the
                current period and metric. Drill the Operation Types treemap for
                Soroban functions when data is present.
              </p>
            ) : (
              <ContractFunctionBarChart
                rows={functionBreakdown.rows}
                configuredLimit={functionBreakdown.configuredLimit}
                opsUnitLabel={opsUnitLabel}
                onOpenDrill={(row) => {
                  setTreemapView("events");
                  setActiveLevelPath(row.drillPath);
                  const leaf = row.drillPath[row.drillPath.length - 1];
                  setSelectedNode({
                    name: leaf.name,
                    value: Number(leaf.value ?? row.opCount),
                    share: leaf.meta?.share ?? row.sharePercent / 100,
                    meta: leaf.meta,
                  });
                }}
              />
            )}
            <p className="mt-2 text-[11px] text-zinc-600">
              Function names reflect the invoked method&apos;s symbol argument when
              present; some invocations fall back to the raw operation type. See{" "}
              <code className="rounded bg-black/30 px-1 py-0.5">
                docs/contract-function-naming.md
              </code>{" "}
              for the full methodology and naming limits.
            </p>
          </section>
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
                  {selectedNode.meta.coverage.namedEntityCount} of{" "}
                  {selectedNode.meta.coverage.configuredLimit}
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
    </div>
  );
}
