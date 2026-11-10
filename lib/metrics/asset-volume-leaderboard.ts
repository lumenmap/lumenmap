import { lookupEntity } from "@/lib/entities/registry";

export type AssetLeaderboardSortKey =
  | "volume"
  | "opCount"
  | "sharePercent"
  | "code";
export type SortDirection = "asc" | "desc";

export interface AssetVolumeLeaderboardRow {
  key: string;
  code: string;
  assetKind: "native" | "classic" | "sac";
  issuerOrSacAddress: string | null;
  issuerLabel: string | null;
  volume: number;
  opCount: number;
  sharePercent: number;
}

function parseSafePositiveNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Normalize and rank SAC (`C...`), classic issued (`G...`), and native (`XLM`)
 * asset payment volume rows. Unparseable or negative amounts soft-fail by
 * being skipped rather than throwing.
 */
export function mapAssetVolumeLeaderboardRows(
  rows: unknown,
  lookupLabel: (address: string) => string | undefined = (addr) =>
    lookupEntity(addr)?.name,
): AssetVolumeLeaderboardRow[] {
  const list = Array.isArray(rows) ? rows : [];
  const parsed: Omit<AssetVolumeLeaderboardRow, "sharePercent">[] = [];

  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;

    const assetObj = asRecord(row.asset);
    const code = (
      typeof assetObj?.code === "string"
        ? assetObj.code
        : typeof row.code === "string"
          ? row.code
          : ""
    ).trim();
    if (!code) continue;

    const volume = parseSafePositiveNumber(row.amount ?? row.volume);
    if (volume === null) continue;

    const opCountRaw = parseSafePositiveNumber(row.opCount ?? row.op_count);
    const opCount = opCountRaw !== null ? Math.round(opCountRaw) : 0;

    const rawAddress = (
      typeof assetObj?.issuer === "string"
        ? assetObj.issuer
        : typeof row.issuerOrSacAddress === "string"
          ? row.issuerOrSacAddress
          : typeof row.sacAddress === "string"
            ? row.sacAddress
            : ""
    ).trim();

    const isNative =
      assetObj?.type === "native" || (!rawAddress && code.toUpperCase() === "XLM");
    const assetKind: "native" | "classic" | "sac" = isNative
      ? "native"
      : rawAddress.startsWith("C")
        ? "sac"
        : "classic";

    const issuerOrSacAddress = isNative ? null : rawAddress || null;
    const issuerLabel = issuerOrSacAddress
      ? lookupLabel(issuerOrSacAddress) ?? null
      : "Native Stellar";

    parsed.push({
      key: `${code}:${issuerOrSacAddress ?? "native"}`,
      code,
      assetKind,
      issuerOrSacAddress,
      issuerLabel,
      volume,
      opCount,
    });
  }

  const totalOps = parsed.reduce((sum, r) => sum + r.opCount, 0);

  return parsed.map((row) => ({
    ...row,
    sharePercent:
      totalOps > 0 ? Number(((row.opCount / totalOps) * 100).toFixed(2)) : 0,
  }));
}

export function sortAssetVolumeLeaderboard(
  rows: readonly AssetVolumeLeaderboardRow[],
  sortKey: AssetLeaderboardSortKey = "volume",
  direction: SortDirection = "desc",
): AssetVolumeLeaderboardRow[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === "code") {
      return a.code.localeCompare(b.code) * factor || b.volume - a.volume;
    }
    const diff = a[sortKey] - b[sortKey];
    if (diff !== 0) return diff * factor;
    return a.key.localeCompare(b.key);
  });
}

/**
 * Documented fixture with 9 assets (>= 8 required) covering native XLM,
 * classic issued assets, Soroban Asset Contracts (SAC), and unknown issuers.
 */
export const ASSET_VOLUME_LEADERBOARD_FIXTURE = [
  {
    asset: { code: "XLM", type: "native" as const },
    amount: "48500000",
    opCount: 18400,
  },
  {
    asset: {
      code: "USDC",
      type: "issued" as const,
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
    amount: "31200000",
    opCount: 14200,
  },
  {
    asset: {
      code: "USDC",
      type: "issued" as const,
      issuer: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    },
    amount: "14800000",
    opCount: 6800,
  },
  {
    asset: {
      code: "yXLM",
      type: "issued" as const,
      issuer: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
    },
    amount: "9400000",
    opCount: 5100,
  },
  {
    asset: {
      code: "AQUA",
      type: "issued" as const,
      issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
    },
    amount: "82500000",
    opCount: 4300,
  },
  {
    asset: {
      code: "EURC",
      type: "issued" as const,
      issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
    },
    amount: "4100000",
    opCount: 2900,
  },
  {
    asset: {
      code: "BENJI",
      type: "issued" as const,
      issuer: "CBENJISACCONTRACT777777777777777777777777777777777777777",
    },
    amount: "2750000",
    opCount: 1600,
  },
  {
    asset: {
      code: "PYUSD",
      type: "issued" as const,
      issuer: "CPYUSDSACCONTRACT888888888888888888888888888888888888888",
    },
    amount: "1950000",
    opCount: 1200,
  },
  {
    asset: {
      code: "ARS",
      type: "issued" as const,
      issuer: "GUNKNOWNISSUER999999999999999999999999999999999999999999",
    },
    amount: "12500000",
    opCount: 950,
  },
];
