"use client";

import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export function TreemapMetricSelector() {
  const { metric, setMetric } = useDashboard();

  const description =
    metric === "ops"
      ? "Tile size is proportional to the number of operations."
      : metric === "transactions"
        ? "Tile size is proportional to the number of distinct transactions."
        : metric === "xlm_volume"
          ? "Tile size is proportional to XLM payment volume. Other operation types are hidden."
          : "Tile size is proportional to verified USDC payment volume. Unsupported same-code assets are excluded.";

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
          variant={metric === "transactions" ? "default" : "outline"}
          size="sm"
          onClick={() => setMetric("transactions")}
        >
          Transaction Count
        </Button>
        <Button
          variant={metric === "xlm_volume" ? "default" : "outline"}
          size="sm"
          onClick={() => setMetric("xlm_volume")}
        >
          XLM Volume
        </Button>
        <Button
          variant={metric === "usdc" ? "default" : "outline"}
          size="sm"
          onClick={() => setMetric("usdc")}
        >
          USDC Volume
        </Button>
      </div>
      <p className="text-xs text-zinc-500">{description}</p>
    </div>
  );
}
