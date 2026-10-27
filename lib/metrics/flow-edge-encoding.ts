import {
  encodeFlowEdgeWeight,
  type FlowEdgeWeightMetric,
} from "@/lib/metrics/flow-methodology-anchors";

export type { FlowEdgeWeightMetric };

/** Static weight encoding consumed by the table's edge weight bar. */
export interface FlowEdgeEncoding {
  /** Clamped stroke width in CSS pixels. */
  strokeWidth: number;
  /** Clamped opacity in [0, 1]. */
  opacity: number;
  /** Human-readable tooltip with unit-correct values. */
  tooltip: string;
}

/** Structural subset of a flow edge needed to derive its weight. */
export interface FlowEdgeWeightSource {
  id: string;
  /** Aggregated operation count for the edge. */
  operationCount: number;
  /** Aggregated amount in minor units (stroops, 7 decimals). */
  amount: string;
  /** False when the edge contains operations without a reliable amount. */
  amountComplete?: boolean;
  /** Asset code keyed to the amount, when reported. */
  asset?: { code: string };
}

const STROOPS_PER_UNIT = 10_000_000;

function edgeAmountUnits(edge: FlowEdgeWeightSource): number | null {
  if (edge.amountComplete === false) return null;
  const parsed = Number(edge.amount);
  return Number.isFinite(parsed) ? parsed / STROOPS_PER_UNIT : null;
}

/**
 * Derive per-edge weight encodings (stroke width, opacity, tooltip) for the
 * whole graph in one pass. Weight is normalized against the observed
 * min/max of the selected metric so the table and the canvas agree on
 * relative edge weight; encodings are static so reduced-motion users see the
 * same weight.
 */
export function encodeFlowEdges(
  edges: readonly FlowEdgeWeightSource[],
  metric: FlowEdgeWeightMetric,
): Map<string, FlowEdgeEncoding> {
  const values = edges.map((edge) =>
    metric === "asset_amount" ? edgeAmountUnits(edge) : edge.operationCount,
  );
  const finite = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const minMetric = finite.length > 0 ? Math.min(...finite) : 0;
  const maxMetric = finite.length > 0 ? Math.max(...finite) : 0;

  const encodings = new Map<string, FlowEdgeEncoding>();
  edges.forEach((edge, index) => {
    const encoded = encodeFlowEdgeWeight({
      metric,
      opCount: edge.operationCount,
      assetAmount: values[index],
      assetCode: edge.asset?.code ?? null,
      minMetric,
      maxMetric,
      encodeOpacity: true,
    });
    encodings.set(edge.id, {
      strokeWidth: encoded.strokeWidth,
      opacity: encoded.opacity ?? 1,
      tooltip: encoded.tooltip,
    });
  });

  return encodings;
}
