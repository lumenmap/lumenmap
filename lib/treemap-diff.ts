import { getNodeValue } from "@/lib/entities/treemap-level";
import type { TreemapNode } from "@/lib/types";

/**
 * Period-over-period diff model for treemap tiles (issue #447).
 *
 * Every tile in the active window is compared against the node with the same
 * stable key in the previous equal-length window (see
 * `resolvePreviousPeriodRange`). A node that only exists in the active window
 * is "new"; a node that only exists in the previous window is "dropped" — it
 * has no tile (its value would be zero) but is still indexed so the data
 * table can list it.
 */

export type TreemapDiffKind = "grew" | "declined" | "flat" | "new" | "dropped";

export type TreemapDiffBucket =
  | "new"
  | "strong-growth"
  | "growth"
  | "flat"
  | "decline"
  | "strong-decline";

export interface TreemapDelta {
  /** Path-qualified stable key of the node this delta describes. */
  key: string;
  /** Value in the active window. */
  current: number;
  /** Value in the previous equal-length window (0 when absent). */
  previous: number;
  /** current - previous. */
  absolute: number;
  /** Percent change relative to `previous`; null when `previous` is 0. */
  percent: number | null;
  kind: TreemapDiffKind;
}

/**
 * Percent change beyond which tile color saturates. Clamping keeps a single
 * runaway tile from washing out every other tile on the diverging scale; the
 * tooltip and table always show the unclamped value.
 */
export const TREEMAP_DIFF_CLAMP_PERCENT = 50;

/** |percent| below this is visually flat on the diverging scale. */
export const TREEMAP_DIFF_FLAT_BAND_PERCENT = 10;

/** |percent| at or beyond this maps to the strong growth/decline color. */
export const TREEMAP_DIFF_STRONG_BAND_PERCENT = 50;

/**
 * Diverging color scale. Documented in docs/treemap-diff.md; keep the two in
 * sync. Color is never the only encoding — tiles and table rows also carry a
 * signed value and a sign icon.
 */
export const TREEMAP_DIFF_BUCKET_COLORS: Record<TreemapDiffBucket, string> = {
  new: "#a78bfa",
  "strong-growth": "#16a34a",
  growth: "#4ade80",
  flat: "#52525b",
  decline: "#f87171",
  "strong-decline": "#b91c1c",
};

/**
 * Stable identity for a treemap node. Mirrors the key the dashboard already
 * uses for tile identity and drill paths: metadata id first, then the node
 * id, then the display name.
 */
export function treemapNodeKey(node: TreemapNode): string {
  return String(node.meta?.id ?? node.id ?? node.name);
}

/** Path-qualified key for a node at a given drill depth. */
export function treemapPathKey(path: readonly TreemapNode[]): string {
  return path.map(treemapNodeKey).join("/");
}

export function classifyDelta(
  current: number,
  previous: number,
): TreemapDiffKind {
  if (previous === 0 && current > 0) return "new";
  if (current === 0 && previous > 0) return "dropped";
  const absolute = current - previous;
  if (absolute === 0) return "flat";
  return absolute > 0 ? "grew" : "declined";
}

export function calculateTreemapDelta(
  key: string,
  current: number,
  previous: number,
): TreemapDelta {
  const absolute = current - previous;
  return {
    key,
    current,
    previous,
    absolute,
    // A zero or missing previous window has no meaningful percent.
    percent: previous === 0 ? null : (absolute / previous) * 100,
    kind: classifyDelta(current, previous),
  };
}

/** Clamp a percent change into [-TREEMAP_DIFF_CLAMP_PERCENT, +clamp]. */
export function clampDiffPercent(percent: number): number {
  return Math.min(
    TREEMAP_DIFF_CLAMP_PERCENT,
    Math.max(-TREEMAP_DIFF_CLAMP_PERCENT, percent),
  );
}

export function diffColorBucket(delta: TreemapDelta): TreemapDiffBucket {
  if (delta.kind === "new") return "new";
  // Dropped nodes have no tile, but the bucket keeps table/badge colors total.
  if (delta.kind === "dropped") return "strong-decline";
  const percent = delta.percent ?? 0;
  if (percent >= TREEMAP_DIFF_STRONG_BAND_PERCENT) return "strong-growth";
  if (percent >= TREEMAP_DIFF_FLAT_BAND_PERCENT) return "growth";
  if (percent <= -TREEMAP_DIFF_STRONG_BAND_PERCENT) return "strong-decline";
  if (percent <= -TREEMAP_DIFF_FLAT_BAND_PERCENT) return "decline";
  return "flat";
}

export function diffColor(delta: TreemapDelta): string {
  return TREEMAP_DIFF_BUCKET_COLORS[diffColorBucket(delta)];
}

function formatSigned(value: number, decimals = 1): string {
  const rounded = value.toFixed(decimals);
  return value > 0 ? `+${rounded}` : rounded;
}

/**
 * Human-readable delta summary used in tooltips, tile titles, and screen
 * reader labels. "new" and "dropped" are described in words because a percent
 * is undefined or trivially -100 for them.
 */
export function formatTreemapDeltaText(delta: TreemapDelta): string {
  if (delta.kind === "new") {
    return "new in this window (no previous activity)";
  }
  if (delta.kind === "dropped") {
    return `dropped since previous window (was ${formatCompactValue(delta.previous)})`;
  }
  const percentText =
    delta.percent === null ? "n/a" : `${formatSigned(delta.percent)}%`;
  const sign = delta.absolute > 0 ? "+" : "";
  return `${sign}${formatCompactValue(delta.absolute)} (${percentText}) vs previous window`;
}

function formatCompactValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export interface TreemapDiffIndex {
  /**
   * Delta for every node reachable from either tree, keyed by its
   * path-qualified stable key (children of the root have no prefix).
   */
  deltas: Map<string, TreemapDelta>;
  /**
   * Nodes that exist only in the previous window, grouped by their parent's
   * path key ("" for children of the root). Dropped nodes keep their
   * previous-window value so the table can show what disappeared.
   */
  droppedByParent: Map<string, TreemapNode[]>;
}

/**
 * Walk the active and previous treemaps in parallel and index the delta of
 * every node by stable key. Matching happens per sibling set, so a renamed
 * label still matches via its id, and a node that only exists on one side is
 * classified as new or dropped (its subtree is not walked further — from the
 * other side's perspective the whole subtree appeared or vanished).
 */
export function buildTreemapDiffIndex(
  current: TreemapNode | null | undefined,
  previous: TreemapNode | null | undefined,
): TreemapDiffIndex {
  const deltas = new Map<string, TreemapDelta>();
  const droppedByParent = new Map<string, TreemapNode[]>();

  const walk = (
    active: TreemapNode | undefined,
    prior: TreemapNode | undefined,
    prefix: string,
  ): void => {
    const activeChildren = new Map(
      (active?.children ?? []).map((child) => [treemapNodeKey(child), child]),
    );
    const previousChildren = new Map(
      (prior?.children ?? []).map((child) => [treemapNodeKey(child), child]),
    );

    for (const [key, child] of activeChildren) {
      const pathKey = prefix ? `${prefix}/${key}` : key;
      const previousChild = previousChildren.get(key);
      deltas.set(
        pathKey,
        calculateTreemapDelta(
          pathKey,
          getNodeValue(child),
          previousChild ? getNodeValue(previousChild) : 0,
        ),
      );
      walk(child, previousChild, pathKey);
    }

    for (const [key, previousChild] of previousChildren) {
      if (activeChildren.has(key)) continue;
      const pathKey = prefix ? `${prefix}/${key}` : key;
      deltas.set(
        pathKey,
        calculateTreemapDelta(pathKey, 0, getNodeValue(previousChild)),
      );
      const dropped = droppedByParent.get(prefix);
      if (dropped) {
        dropped.push(previousChild);
      } else {
        droppedByParent.set(prefix, [previousChild]);
      }
    }
  };

  walk(current ?? undefined, previous ?? undefined, "");
  return { deltas, droppedByParent };
}
