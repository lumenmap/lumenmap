"use client";

import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export function TreemapMetricSelector() {
  const { metric, setMetric, data } = useDashboard();

  const hasTransactionData =
    (data?.treemaps.txn_events.children?.length ?? 0) > 0 ||
    Number(data?.treemaps.txn_events.value ?? 0) > 0;

  const description =
    metric === "ops"
      ? "Tile size is proportional to the number of operations."
      : metric === "xlm_volume"
        ? "Tile size is proportional to XLM payment volume. Other operation types are hidden."
        : metric === "usdc"
          ? "Tile size is proportional to verified USDC payment volume. Unsupported same-code assets are excluded."
          : "Tile size is proportional to the number of distinct transactions.";

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
          variant={metric === "txn" ? "default" : "outline"}
          size="sm"
          onClick={() => setMetric("txn")}
          disabled={!hasTransactionData}
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
