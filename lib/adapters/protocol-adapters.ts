import type { ProtocolAdapter, ProtocolSnapshot, AdapterStatus } from "@/lib/types";

// Mock TVL data for demonstration - in production, this would fetch from real APIs
const MOCK_TVL_DATA: Record<string, number> = {
  soroswap: 15000000,
  circle: 500000000,
  kraken: 100000000,
  lobstr: 50000000,
  moneygram: 75000000,
};

// Mock last updated timestamps
const MOCK_LAST_UPDATED: Record<string, string> = {
  soroswap: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  circle: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
  kraken: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  lobstr: new Date(Date.now() - 86400000).toISOString(), // 1 day ago (stale)
  moneygram: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
};

function getStatus(lastUpdated: string): AdapterStatus {
  const now = Date.now();
  const updated = new Date(lastUpdated).getTime();
  const ageHours = (now - updated) / (1000 * 60 * 60);

  if (ageHours > 24) {
    return "stale";
  }
  if (ageHours > 6) {
    return "partial";
  }
  return "valid";
}

function createAdapter(
  protocolId: string,
  protocolName: string,
): ProtocolAdapter {
  return {
    protocolId,
    protocolName,
    validate: () => {
      const lastUpdated = MOCK_LAST_UPDATED[protocolId];
      if (!lastUpdated) {
        return "invalid";
      }
      return getStatus(lastUpdated);
    },
    fetchTVL: async () => {
      const tvlUsd = MOCK_TVL_DATA[protocolId] || 0;
      const lastUpdated = MOCK_LAST_UPDATED[protocolId] || new Date().toISOString();
      const status = getStatus(lastUpdated);

      return {
        protocol: protocolName,
        tvlUsd,
        snapshotTime: lastUpdated,
        status,
        metadata: {
          source: "mock_adapter",
          lastUpdated,
          confidence: status === "valid" ? 0.95 : status === "partial" ? 0.7 : 0.4,
        },
      };
    },
  };
}

export const PROTOCOL_ADAPTERS: ProtocolAdapter[] = [
  createAdapter("soroswap", "Soroswap"),
  createAdapter("circle", "Circle"),
  createAdapter("kraken", "Kraken"),
  createAdapter("lobstr", "LOBSTR"),
  createAdapter("moneygram", "MoneyGram"),
];

export async function fetchAllProtocolSnapshots(): Promise<ProtocolSnapshot[]> {
  const snapshots = await Promise.all(
    PROTOCOL_ADAPTERS.map(async (adapter) => {
      const status = adapter.validate();
      if (status === "invalid") {
        return null;
      }
      return adapter.fetchTVL();
    }),
  );

  return snapshots.filter(
    (snapshot): snapshot is ProtocolSnapshot => snapshot !== null,
  );
}

export function getProtocolAdapter(protocolId: string): ProtocolAdapter | undefined {
  return PROTOCOL_ADAPTERS.find((adapter) => adapter.protocolId === protocolId);
}
