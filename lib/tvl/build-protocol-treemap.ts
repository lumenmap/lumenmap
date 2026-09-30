import type { TvlAdapterResult } from "@/lib/tvl/adapter";
import type { TreemapPayload, TreemapNode } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  complete: "#10B981",
  partial: "#F59E0B",
  stale: "#EF4444",
  unsupported: "#6B7280",
  failed: "#6B7280",
};

const USD_TVL_UNIT = {
  kind: "asset" as const,
  asset: { type: "issued" as const, code: "USD", issuer: "adapter" },
};

function sumUsd(result: TvlAdapterResult): number {
  if (!("positions" in result)) return 0;
  return result.positions.reduce(
    (sum, position) => sum + Number(position.usdValue || 0),
    0,
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    case "stale":
      return "Stale";
    case "unsupported":
      return "Unsupported";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

/**
 * Build a Protocol TVL treemap from adapter results.
 *
 * Every result becomes a tile, including `failed` and `unsupported` ones —
 * a failed adapter call must be visible to the user (as a zero-value tile
 * with the "Failed" status and its documented gray color), not silently
 * dropped from the map. Only `complete`/`partial`/`stale` results
 * contribute USD value to tile sizing and the total, so a failed or
 * unsupported protocol never inflates or distorts the treemap's sizing.
 */
export function buildProtocolTvlTreemap(
  results: TvlAdapterResult[],
): TreemapPayload<"tvl"> {
  const sized = new Set(["complete", "partial", "stale"]);

  const total = results
    .filter((result) => sized.has(result.status))
    .reduce((sum, result) => sum + sumUsd(result), 0);

  const children: TreemapNode<string>[] = results
    .map((result) => {
      const tvlUsd = sized.has(result.status) ? sumUsd(result) : 0;
      const share = total > 0 ? (tvlUsd / total) * 100 : 0;
      return {
        id: result.protocol.toLowerCase(),
        name: result.protocol,
        value: String(tvlUsd),
        color: STATUS_COLORS[result.status] ?? STATUS_COLORS.failed,
        meta: {
          type: "protocol" as const,
          protocol: result.protocol,
          share,
          tvlUsd,
          snapshotTime: result.snapshotTime,
          adapterStatus: result.status,
          adapterStatusLabel: statusLabel(result.status),
          childCount: 0,
        },
      };
    })
    .sort((a, b) => Number(b.value) - Number(a.value));

  return {
    name: "Protocol TVL",
    value: String(total),
    metric: "tvl",
    unit: USD_TVL_UNIT,
    meta: {
      type: "root",
      share: 100,
      tvlUsd: total,
      childCount: children.length,
    },
    children,
  };
}
