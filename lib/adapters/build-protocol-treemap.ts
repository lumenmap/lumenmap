import { CATEGORY_COLORS } from "@/lib/constants";
import type { TreemapNode, ProtocolSnapshot, AdapterStatus } from "@/lib/types";

const STATUS_COLORS: Record<AdapterStatus, string> = {
  valid: "#10B981",
  partial: "#F59E0B",
  stale: "#EF4444",
  invalid: "#6B7280",
};

function getStatusColor(status: AdapterStatus): string {
  return STATUS_COLORS[status];
}

function formatUSD(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function buildProtocolTreemap(snapshots: ProtocolSnapshot[]): TreemapNode {
  // Filter out invalid snapshots
  const validSnapshots = snapshots.filter(
    (snapshot) => snapshot.status !== "invalid",
  );

  if (validSnapshots.length === 0) {
    return {
      name: "Protocol TVL",
      value: 0,
      meta: {
        type: "root",
      },
      children: [],
    };
  }

  const totalTVL = validSnapshots.reduce(
    (sum, snapshot) => sum + snapshot.tvlUsd,
    0,
  );

  const children: TreemapNode[] = validSnapshots
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .map((snapshot) => {
      const share = totalTVL > 0 ? (snapshot.tvlUsd / totalTVL) * 100 : 0;
      const statusColor = getStatusColor(snapshot.status);

      return {
        id: snapshot.protocol.toLowerCase(),
        name: snapshot.protocol,
        value: snapshot.tvlUsd,
        color: statusColor,
        meta: {
          type: "protocol",
          protocol: snapshot.protocol,
          share,
          tvlUsd: snapshot.tvlUsd,
          snapshotTime: snapshot.snapshotTime,
          status: snapshot.status,
          confidence: snapshot.metadata?.confidence,
          source: snapshot.metadata?.source,
        },
      };
    });

  return {
    name: "Protocol TVL",
    value: totalTVL,
    meta: {
      type: "root",
      totalTVL,
      protocolCount: validSnapshots.length,
    },
    children,
  };
}

export { formatUSD };
