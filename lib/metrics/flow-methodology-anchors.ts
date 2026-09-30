/**
 * Stable `/methodology` anchor ids for the payment-flow graph section.
 *
 * The Flow view legend and coverage badge link to these anchors, so the ids
 * are part of the public URL surface: do not rename them without keeping a
 * redirect-compatible alias.
 */
export const FLOW_METHODOLOGY_ANCHORS = {
  flow: "flow",
  nodes: "flow-nodes",
  edges: "flow-edges",
  sampling: "flow-sampling",
  assetModes: "flow-asset-modes",
} as const;

export type FlowMethodologyAnchor =
  (typeof FLOW_METHODOLOGY_ANCHORS)[keyof typeof FLOW_METHODOLOGY_ANCHORS];

/** In-app href for a payment-flow methodology anchor. */
export function flowMethodologyHref(anchor: FlowMethodologyAnchor): string {
  return `/methodology#${anchor}`;
}

/**
 * Edge weight encoding for the payment-flow graph.
 *
 * The Flow view maps higher-weight corridors to thicker strokes (and
 * optionally higher opacity) so high-volume edges are easy to spot. The
 * metric is either the operation count or the asset amount for the edge,
 * per the flow methodology. Stroke widths are clamped for readability and
 * render as static SVG strokes so reduced-motion users see the same
 * weight encoding.
 */

/** Minimum rendered edge stroke width in CSS pixels. */
export const FLOW_EDGE_STROKE_MIN = 1;

/** Maximum rendered edge stroke width in CSS pixels. */
export const FLOW_EDGE_STROKE_MAX = 12;

/** Minimum rendered edge opacity. */
export const FLOW_EDGE_OPACITY_MIN = 0.35

/** Maximum rendered edge opacity. */
export const FLOW_EDGE_OPACITY_MAX_ = 1;

/** Metric used to derive edge weight. */
export type FlowEdgeWeightMetric = "op_count" | "asset_amount";

export interface FlowEdgeWeightInput {
  /** Metric to encode as thickness. */
  metric: FlowEdgeWeightMetric;
  /** Operation count for the edge, when available. */
  opCount?: number | null;
  /** Asset amount for the edge, when available. */
  assetAmount?: number | null;
  /** Asset code (e.g. XLM, USDC) keyed to the asset amount. */
  assetCode?: string | null;
  /** Observed minimum metric value across the graph for normalization. */
  minMetric?: number;
  /** Observed maximum metric value across the graph for normalization. */
  maxMetric?: number;
  /** Override the minimum stroke width in CSS pixels. */
  minStroke?: number;
  /** Override the maximum stroke width in CSS pixels. */
  maxStroke?: number;
  /** Whether to also encode weight as opacity. */
  encodeOpacity?: boolean;
}

export interface FlowEdgeWeightEncoding {
  /** Metric used for this encoding. */
  metric: FlowEdgeWeightMetric;
  /** Raw metric value for the edge, or null when missing. */
  value: number | null;
  /** Normalized weight in [0, 1]. */
  normalized: number;
  /** Clamped stroke width in CSS pixels. */
  strokeWidth: number;
  /** Clamped opacity in [0, 1], or null when opacity encoding is off. */
  opacity: number | null;
  /** Asset code associated with the metric, if any. */
  assetCode: string | null;
  /** Human-readable tooltip text with unit-correct values. */
  tooltip: string;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.finite(value)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeMetric(
  value: number,
  minMetric: number,
  maxMetric: number,
): number {
  if (!Number.finite(value)) return 0;
  if (!Number.finite(minMetric) || !Number.finite(maxMetric)) return 0;
  if (maxMetric <= minMetric) return value > minMetric ? 1 : 0;
  return clamp((value - minMetric) / (maxMetric - minMetric), 0, 1);
}

const opCountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const assetAmountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 7,
});

/** Format an operation count with unit-correct labeling. */
export function formatFlowOpCount(opCount: number): string {
  const value = Number.isFinite(opCount) ? opCount : 0;
  const label = value === 1 ? "operation" : "operations";
  return `${opCountFormatter.format(value)} ${label}`;
}

/** Format an asset amount with its asset code. */
export function formatFlowAssetAmount(
  assetAmount: number,
  assetCode?: string | null,
): string {
  const value = Number.isFinite(assetAmount) ? assetAmount : 0;
  const formatted = assetAmountFormatter.format(value);
  const code = assetCode && assetCode.trim().length > 0 ? assetCode.trim() : null;
  return code ? `${formatted} ${code}` : formatted;
}

/**
 * Derive the static edge weight encoding (stroke width, optional opacity,
 * tooltip) for a flow edge. Stroke width is always clamped to [FLOW_EDGE_STROKE_MIN,
 * FLOW_EDGE_STROKE_MAX] so higher-weight edges render thicker within clamps.
 */
export function encodeFlowEdgeWeight(
  input: FlowEdgeWeightInput,
): FlowEdgeWeightEncoding {
  const minStroke = Number.isFinite(input.minStroke)
    ? Math.max(0, input.minStroke as number)
    : FLOW_EDGE_STROKE_MIN;
  const maxStroke = Number.isFinite(input.maxStroke)
    ? Math.max(minStroke, input.maxStroke as number)
    : Math.max(minStroke, FLOW_EDGE_STROKE_MAX);

  const assetCode = input.assetCode && input.assetCode.trim().length > 0
    ? input.assetCode.trim()
    : null;

  const rawValue = input.metric === "asset_amount"
    ? input.assetAmount
    : input.opCount;

  const value = typeof rawValue === "number" && Number.isFinite(rawValue)
    ? rawValue
    : null;

  const minMetric = Number.isFinite(input.minMetric)
    ? (input.minMetric as number)
    : 0;
  const maxMetric = Number.isFinite(input.maxMetric)
    ? (input.maxMetric as number)
    : minMetric;

  const normalized = value === null
    ? 0
    : normalizeMetric(value, minMetric, maxMetric);

  const strokeWidth = clamp(
    minStroke + normalized * (maxStroke - minStroke),
    minStroke,
    maxStroke,
  );

  const opacity = input.encodeOpacity
    ? clamp(
        FLOW_EDGE_OPACITY_MIN +
          normalized * (FLOW_EDGE_OPACITY_MAX - FLOW_EDGE_OPACITY_MIN),
        FLOW_EDGE_OPACITY_MIN,
        FLOW_EDGE_OPACITY_MAX,
      )
    : null;

  const metricLabel = input.metric === "asset_amount"
    ? formatFlowAssetAmount(value ?? 0, assetCode)
    : formatFlowOpCount(value ?? 0);

  const tooltip = value === null
    ? `${input.metric === "asset_amount" ? "Asset amount" : "Operation count"}: not reported`
    : metricLabel;

  return {
    metric: input.metric,
    value,
    normalized,
    strokeWidth,
    opacity,
    assetCode,
    tooltip,
  };
}
