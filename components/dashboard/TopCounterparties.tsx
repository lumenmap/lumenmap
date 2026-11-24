"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { StellarExpertLink } from "@/components/dashboard/StellarExpertLink";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import {
  rankTopCounterparties,
  TOP_COUNTERPARTIES_LIMIT,
  type CounterpartyEdgeInput,
  type RankedCounterparty,
} from "@/lib/entities/top-counterparties";
import { formatExactNumber, truncateAddress } from "@/lib/utils";
import type { Period } from "@/lib/types";

type FlowApiResponse = {
  sampled?: boolean;
  nodes?: Array<{ id: string; label: string; category?: string }>;
  edges?: CounterpartyEdgeInput[];
};

async function fetchAccountFlowEdges(
  period: Period,
  network: string,
  account: string,
): Promise<FlowApiResponse> {
  const params = new URLSearchParams({
    period,
    network,
    account,
  });
  const response = await fetch(`/api/v1/flow?${params}`);
  if (!response.ok) {
    throw new Error(`Counterparty lookup failed (HTTP ${response.status})`);
  }
  return (await response.json()) as FlowApiResponse;
}

function formatSafeVolume(row: RankedCounterparty): string | null {
  if (!row.volume) return null;
  // Keep the integer string — avoid Number() precision loss on large stroop sums.
  const formatted = row.volume.amount.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted} ${row.volume.assetCode} (stroops)`;
}

/**
 * Top-N counterparties for the selected account on DetailPanel.
 *
 * Uses `/api/v1/flow` ego edges independently of the Flow chart feature flag,
 * soft-fails on errors, and ranks with {@link rankTopCounterparties}. Contract
 * selections render a quiet empty state — payment edges are account-addressed.
 */
export function TopCounterparties() {
  const { selectedNode, setSelectedNode, data, network, period } = useDashboard();
  const [activeId, setActiveId] = useState<string | null>(null);

  const address = selectedNode?.meta?.id;
  const entityType = selectedNode?.meta?.type;
  const isAccount = entityType === "account" && Boolean(address?.startsWith("G"));

  const queryPeriod = (period ?? data?.period ?? "1d") as Period;

  const { data: flowData, isPending, isError } = useQuery({
    queryKey: ["detail-top-counterparties", network, queryPeriod, address],
    queryFn: () => fetchAccountFlowEdges(queryPeriod, network, address!),
    enabled: isAccount,
    retry: false,
    staleTime: 60_000,
  });

  const ranked = useMemo(() => {
    if (!address || !flowData?.edges) {
      return rankTopCounterparties(address ?? "", []);
    }
    return rankTopCounterparties(address, flowData.edges, {
      nodes: flowData.nodes,
      limit: TOP_COUNTERPARTIES_LIMIT,
    });
  }, [address, flowData]);

  if (!address || (entityType !== "account" && entityType !== "contract")) {
    return null;
  }

  const openCounterparty = (row: RankedCounterparty) => {
    setActiveId(row.id);
    setSelectedNode({
      name: row.label,
      value: row.operationCount,
      share: 0,
      meta: {
        type: "account",
        id: row.id,
        category: row.category,
      },
    });
  };

  return (
    <section
      aria-labelledby="top-counterparties-heading"
      className="rounded-lg border border-white/10 bg-black/20 p-3"
      data-testid="top-counterparties"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3
          id="top-counterparties-heading"
          className="text-xs font-semibold text-zinc-400"
        >
          Top counterparties
        </h3>
        {flowData?.sampled ? (
          <Badge
            variant="secondary"
            className="border-amber-800/70 bg-amber-950/40 text-amber-100"
            data-testid="top-counterparties-sampled"
          >
            Sampled coverage
          </Badge>
        ) : null}
      </div>
      <p className="mb-2 text-[11px] text-zinc-600">
        Top {TOP_COUNTERPARTIES_LIMIT} by operation count in the selected period.
        Volume shown only for single-asset complete edges (no cross-asset sums).
      </p>

      {!isAccount ? (
        <p className="text-sm text-zinc-400" role="status">
          Counterparty ranking uses account payment edges and is not available
          for contracts.
        </p>
      ) : isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading counterparties">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-zinc-400" role="status">
          Counterparties unavailable for this period. Other entity details still
          apply.
        </p>
      ) : ranked.rows.length === 0 ? (
        <p className="text-sm text-zinc-400" role="status">
          No payment counterparties found for this account in the selected
          period.
        </p>
      ) : (
        <>
          <ul
            role="listbox"
            aria-label="Top counterparties"
            className="flex flex-col gap-1.5"
          >
            {ranked.rows.map((row) => {
              const volumeLabel = formatSafeVolume(row);
              const selected = activeId === row.id;
              return (
                <li
                  key={row.id}
                  role="option"
                  aria-selected={selected}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
                >
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => openCounterparty(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCounterparty(row);
                      }
                    }}
                    className="w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar"
                    aria-label={`${row.label}: ${formatExactNumber(row.operationCount)} operations. Open detail.`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-white">{row.label}</span>
                      <span className="shrink-0 font-mono text-xs text-zinc-400">
                        {formatExactNumber(row.operationCount)} ops
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-zinc-500">
                      {truncateAddress(row.id)}
                      {volumeLabel ? ` · ${volumeLabel}` : ""}
                    </div>
                  </button>
                  <div className="mt-1">
                    <StellarExpertLink
                      address={row.id}
                      type="account"
                      className="text-[11px]"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {ranked.hasMore ? (
            <p className="mt-2 text-[11px] text-zinc-500" data-testid="top-counterparties-more">
              And {formatExactNumber(ranked.moreCount)} more counterpart
              {ranked.moreCount === 1 ? "y" : "ies"} beyond the top{" "}
              {ranked.configuredLimit}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
