"use client";

import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export function TreemapMetricSelector() {
  const { metric, setMetric, data, treemapView } = useDashboard();

  const activeTxnTreemap = treemapView === "events" 
    ? data?.treemaps.txn_events 
    : data?.treemaps[`txn_${treemapView}` as keyof typeof data.treemaps];
  const transactionsAvailable = !!data && (activeTxnTreemap?.children?.length ?? 0) > 0;

  const description =
    metric === "ops"
      ? "Tile size is proportional to the number of operations."
      : metric === "xlm_volume"
        ? "Tile size is proportional to XLM payment volume. Other operation types are hidden."
        : metric === "usdc"
          ? "Tile size is proportional to verified USDC payment volume. Unsupported same-code assets are excluded."
          : metric === "protocol_tvl"
            ? "Tile size is proportional to adapter-backed protocol TVL in USD. Partial and stale adapters stay visible."
            : "Tile size is proportional to the number of transactions.";

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div
        role="group"
        aria-label="Treemap metric"
        className="flex flex-wrap gap-2"
      >
        <Button
          variant={metric === "ops" ? "default" : "outline"}
          size="sm"
          aria-pressed={metric === "ops"}
          onClick={() => setMetric("ops")}
        >
          Operation Count
        </Button>
        <Button
          variant={metric === "xlm_volume" ? "default" : "outline"}
          size="sm"
          aria-pressed={metric === "xlm_volume"}
          onClick={() => setMetric("xlm_volume")}
        >
          XLM Volume
        </Button>
        <Button
          variant={metric === "usdc" ? "default" : "outline"}
          size="sm"
          aria-pressed={metric === "usdc"}
          onClick={() => setMetric("usdc")}
        >
          USDC Volume
        </Button>
        <Button
          variant={metric === "transactions" ? "default" : "outline"}
          size="sm"
          aria-pressed={metric === "transactions"}
          onClick={() => setMetric("transactions")}
          disabled={!transactionsAvailable}
          aria-disabled={!transactionsAvailable}
          title={
            transactionsAvailable
              ? "Size tiles by transaction count"
              : "No transaction data available for this period"
          }
        >
          Transaction Count
        </Button>
        <Button
          variant={metric === "protocol_tvl" ? "default" : "outline"}
          size="sm"
          aria-pressed={metric === "protocol_tvl"}
          onClick={() => setMetric("protocol_tvl")}
          title="Size tiles by adapter-backed protocol TVL in USD"
        >
          Protocol TVL
        </Button>
      </div>
      <p className="text-xs text-text-muted">{description}</p>
    </div>
  );
}
