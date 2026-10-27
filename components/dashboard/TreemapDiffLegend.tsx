"use client";

import {
  TREEMAP_DIFF_BUCKET_COLORS,
  type TreemapDiffBucket,
} from "@/lib/treemap-diff";

/**
 * Accessible legend for the treemap diff overlay (issue #447). It documents
 * the diverging color scale and the "new"/"dropped" handling in text, so the
 * meaning of every tile color is available without relying on color vision.
 * Keep in sync with docs/treemap-diff.md.
 */
const LEGEND_ITEMS: { bucket: TreemapDiffBucket; label: string }[] = [
  { bucket: "new", label: "New (no previous activity)" },
  { bucket: "strong-growth", label: "Growth ≥ +50%" },
  { bucket: "growth", label: "Growth +10% to +50%" },
  { bucket: "flat", label: "Flat within ±10%" },
  { bucket: "decline", label: "Decline −10% to −50%" },
  { bucket: "strong-decline", label: "Decline ≤ −50%" },
];

export function TreemapDiffLegend() {
  return (
    <div className="space-y-1.5">
      <div
        role="group"
        aria-label="Change versus previous window legend"
        data-testid="treemap-diff-legend"
        className="flex flex-wrap items-center gap-2"
      >
        {LEGEND_ITEMS.map((item) => (
          <span
            key={item.bucket}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300"
          >
            <svg
              width="12"
              height="12"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <rect
                width="12"
                height="12"
                rx="3"
                fill={TREEMAP_DIFF_BUCKET_COLORS[item.bucket]}
              />
            </svg>
            {item.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Color saturates at ±50% change; tooltips and the table always show the
        exact value. Tiles that disappear since the previous window have no
        size to render, so they are listed as{" "}
        <span className="text-zinc-300">Dropped</span> rows in the table below.
      </p>
    </div>
  );
}
