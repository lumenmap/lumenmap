"use client";

import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export function TreemapMetricSelector() {
  const { metric, setMetric } = useDashboard();

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={metric === "ops" ? "default" : "outline"}
          size="sm"
          onClick={() => setMetric("ops")}
        >
          Operation Count
        </Button>
        <Button
          variant={metric === "xlm_volume" ? "default" : "outline"}
          size="sm"
          onClick={() => setMetric("xlm_volume")}
        >
          XLM Volume
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        {metric === "ops"
          ? "Tile size is proportional to the number of operations."
          : "Tile size is proportional to XLM payment volume. Other operation types are hidden."}
      </p>
    </div>
  );
}
