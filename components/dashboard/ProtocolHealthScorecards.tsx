"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PROTOCOL_HEALTH_COMPONENT_LABELS } from "@/lib/protocol-health/constants";
import type { ProtocolHealthComponentId } from "@/lib/protocol-health/constants";
import { attachProtocolSeries } from "@/lib/protocol-health/attach-series";
import type { ProtocolHealthResponseBody } from "@/lib/schemas/protocol-health";
import { isMetricSupportedOnNetwork } from "@/lib/network";
import type { SearchResult } from "@/lib/search/types";
import type { TreemapNode } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const COMPONENT_ORDER: ProtocolHealthComponentId[] = [
  "ops",
  "wallets",
  "volume",
  "tvl",
];

async function fetchProtocolHealth(
  period: string,
  network: string,
): Promise<ProtocolHealthResponseBody> {
  const params = new URLSearchParams({ period });
  if (network !== "mainnet") params.set("network", network);
  const response = await fetch(`/api/v1/protocols/health?${params}`);
  if (!response.ok) {
    throw new Error("Failed to load protocol health");
  }
  return response.json() as Promise<ProtocolHealthResponseBody>;
}

function formatComponentValue(
  id: ProtocolHealthComponentId,
  value: number | null,
  status: "available" | "unavailable",
): string {
  if (status === "unavailable" || value == null) return "unavailable";
  if (id === "tvl") return `$${formatNumber(value)}`;
  if (id === "volume") return `${formatNumber(value)} XLM`;
  return formatNumber(value);
}

export function ProtocolHealthScorecards() {
  const {
    period,
    network,
    data,
    setChartView,
    setMetric,
    setSelectedNode,
    setActiveLevelPath,
    selectSearchResult,
  } = useDashboard();

  const query = useQuery({
    queryKey: ["protocol-health", period, network],
    queryFn: () => fetchProtocolHealth(period, network),
    staleTime: 60_000,
  });
  const leaderboardRows = query.data
    ? attachProtocolSeries(
        query.data.protocols,
        query.data.protocols
          .filter((row) => row.timeseries)
          .map((row) => ({ protocol: row.protocol, values: row.timeseries ?? [] })),
      )
    : [];

  const openCard = (card: ProtocolHealthResponseBody["protocols"][number]) => {
    const child = data?.treemaps.protocol_tvl.children?.find(
      (node) =>
        node.name.toLowerCase() === card.protocol.toLowerCase() ||
        node.id?.toLowerCase() === card.protocol.toLowerCase(),
    );
    const canOpenProtocol =
      card.detail.context === "protocol" &&
      child != null &&
      isMetricSupportedOnNetwork("protocol_tvl", network);

    if (canOpenProtocol && child) {
      const value = Number(child.value ?? child.meta?.tvlUsd ?? 0);
      const node: TreemapNode = {
        id: child.id,
        name: child.name,
        value,
        color: child.color,
        meta: child.meta,
      };
      setChartView("treemap");
      setMetric("protocol_tvl");
      setActiveLevelPath([node]);
      setSelectedNode({
        name: node.name,
        value,
        share: child.meta?.share ?? 0,
        meta: child.meta,
      });
    } else {
      const result: SearchResult = {
        key: `protocol:${card.protocol.toLowerCase()}`,
        type: "protocol",
        label: card.protocol,
        protocol: card.protocol,
        id: card.detail.entityId,
        treemapView: "actors",
        nodeType: card.detail.entityId?.startsWith("C") ? "contract" : "entity",
        opCount: card.components.ops.value ?? 0,
      };
      selectSearchResult(result);
    }

    document
      .getElementById("detail-panel-container")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <section aria-labelledby="protocol-health-heading" className="min-w-0">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2
            id="protocol-health-heading"
            className="text-base font-semibold text-white"
          >
            Protocol health
          </h2>
          <p className="text-xs text-zinc-400">
            Composite of operations, wallets, volume, and TVL. A missing input
            is dropped, not scored as zero.
          </p>
        </div>
        <a
          href="/methodology#protocol-health"
          className="shrink-0 text-xs text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
        >
          How the score is calculated
        </a>
      </div>

      {query.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-100"
        >
          Protocol health scorecards are unavailable for this period.
        </p>
      ) : query.isLoading || !query.data ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <ul
          data-testid="protocol-health-grid"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {leaderboardRows.slice(0, query.data.displayLimit).map((card) => {
            const points = card.timeseries;
            return (
              <li key={card.protocol} className="min-w-0">
                <a
                  href={card.detail.href}
                  data-testid={`protocol-health-card-${card.protocol}`}
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey ||
                      event.button !== 0
                    ) {
                      return;
                    }
                    event.preventDefault();
                    openCard(card);
                  }}
                  className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar"
                >
                  <Card className="h-full transition-colors hover:border-white/20">
                    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500">#{card.rank}</p>
                        <CardTitle className="truncate text-base text-white">
                          {card.protocol}
                        </CardTitle>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="text-2xl font-semibold tabular-nums text-white">
                          {card.score == null ? "—" : card.score.toFixed(1)}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
                          / 100
                        </span>
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        {COMPONENT_ORDER.map((id) => {
                          const component = card.components[id];
                          return (
                            <div key={id} className="min-w-0">
                              <dt className="text-zinc-500">
                                {PROTOCOL_HEALTH_COMPONENT_LABELS[id]}
                              </dt>
                              <dd
                                className={
                                  component.status === "unavailable"
                                    ? "truncate text-zinc-500"
                                    : "truncate text-zinc-200"
                                }
                              >
                                {formatComponentValue(
                                  id,
                                  component.value,
                                  component.status,
                                )}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                      {points && points.length >= 2 ? (
                        <div
                          title={`Recent operations: ${formatNumber(points[0])} to ${formatNumber(points[points.length - 1])}`}
                          className="h-8"
                        >
                          <Sparkline
                            data={points}
                            label={`${card.protocol} operations trend, ${formatNumber(points[0])} at the start and ${formatNumber(points[points.length - 1])} at the end`}
                            description={`Recent operations: ${formatNumber(points[0])} to ${formatNumber(points[points.length - 1])}`}
                          />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
