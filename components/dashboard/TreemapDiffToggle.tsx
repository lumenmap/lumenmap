"use client";

import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

/**
 * Toggles the treemap period-over-period diff overlay (issue #447). When
 * active, tiles are colored by percent change against the previous
 * equal-length window and the data table gains a delta column.
 *
 * The toggle is disabled for protocol TVL: adapters report a current
 * snapshot, so a previous-window fetch would return today's values and every
 * tile would read as flat.
 */
export function TreemapDiffToggle() {
  const { treemapDiff, setTreemapDiff, metric } = useDashboard();
  const unavailable = metric === "protocol_tvl";

  return (
    <Button
      variant={treemapDiff && !unavailable ? "default" : "outline"}
      size="sm"
      aria-pressed={treemapDiff && !unavailable}
      aria-label="Show change versus previous window"
      data-testid="treemap-diff-toggle"
      disabled={unavailable}
      title={
        unavailable
          ? "Period-over-period diff is unavailable for protocol TVL: adapters report a current snapshot."
          : "Color tiles by percent change against the previous equal-length window."
      }
      onClick={() => setTreemapDiff(!treemapDiff)}
    >
      Diff vs previous
    </Button>
  );
}
