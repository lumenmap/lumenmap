import { buildFixtureDataset } from "@/lib/hubble/fixture";
import type { ActivityVisualizationResponse, Period } from "@/lib/types";

export const DETERMINISTIC_START = "2026-07-29T00:00:00.000Z";
export const DETERMINISTIC_END = "2026-07-29T23:59:59.000Z";

function toVisualization(
  period: Period,
  empty = false,
): ActivityVisualizationResponse {
  const data = buildFixtureDataset(period);
  const treemaps = empty
    ? (Object.fromEntries(
        Object.entries(data.treemaps).map(([key, node]) => [
          key,
          {
            ...node,
            value: 0,
            children: [],
            meta: { ...(node.meta ?? { type: "root" as const }), opCount: 0, childCount: 0 },
          },
        ]),
      ) as ActivityVisualizationResponse["treemaps"])
    : data.treemaps;

  return {
    period: data.period,
    start: DETERMINISTIC_START,
    end: DETERMINISTIC_END,
    source: data.source,
    sourceTimestamp: DETERMINISTIC_END,
    isPeriodComplete: data.isPeriodComplete,
    liquidityFlow: data.liquidityFlow,
    kpis: empty
      ? {
          totalOps: { kind: "operations", unit: "ops", value: 0 },
          sorobanShare: { kind: "share", unit: "percent", value: 0 },
          topCategory: "—",
          activeContracts: { kind: "entity_count", unit: "count", value: 0 },
          activeWallets: { kind: "entity_count", unit: "count", value: 0 },
          activeDestinationAccounts: { kind: "entity_count", unit: "count", value: 0 },
        }
      : data.kpis,
    treemaps,
    metricProvenance: data.metricProvenance,
    fixture: true,
  };
}

export function getMockLoadedActivity(
  period: Period = "1d",
): ActivityVisualizationResponse {
  return toVisualization(period, false);
}

export function getMockEmptyActivity(
  period: Period = "1d",
): ActivityVisualizationResponse {
  return toVisualization(period, true);
}
