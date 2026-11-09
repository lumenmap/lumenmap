import { truncateAddress } from "@/lib/utils";

export type AssetLeaderboardSortKey = "volume" | "opCount" | "share" | "code";
export type SortDirection = "asc" | "desc";

export interface RawAssetLeaderboardRow {
  asset_code?: unknown;
  asset_issuer?: unknown;
  sac_contract_id?: unknown;
  amount?: unknown;
  op_count?: unknown;
  issuer_label?: unknown;
}

export interface AssetLeaderboardEntry {
  id: string;
  code: string;
  kind: "native" | "classic" | "sac";
  address: string | null;
  displayIssuer: string;
  isKnownLabel: boolean;
  volume: number;
  opCount: number;
  sharePercent: number;
}

const MAX_SAFE_VOLUME = 1e15;

export function parseSafeAssetAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || num > MAX_SAFE_VOLUME) {
    return null;
  }
  return num;
}

export function mapAssetLeaderboardRows(
  rows: readonly RawAssetLeaderboardRow[],
): AssetLeaderboardEntry[] {
  const parsed: Omit<AssetLeaderboardEntry, "sharePercent">[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const code =
      typeof row.asset_code === "string" && row.asset_code.trim()
        ? row.asset_code.trim().toUpperCase()
        : null;
    if (!code) continue;

    const volume = parseSafeAssetAmount(row.amount);
    const opCountRaw = Number(row.op_count);
    const opCount =
      Number.isFinite(opCountRaw) && opCountRaw >= 0
        ? Math.floor(opCountRaw)
        : null;
    if (volume === null || opCount === null) continue;

    const sacId =
      typeof row.sac_contract_id === "string" && row.sac_contract_id.trim()
        ? row.sac_contract_id.trim()
        : null;
    const issuer =
      typeof row.asset_issuer === "string" && row.asset_issuer.trim()
        ? row.asset_issuer.trim()
        : null;
    const knownLabel =
      typeof row.issuer_label === "string" && row.issuer_label.trim()
        ? row.issuer_label.trim()
        : null;

    const kind: "native" | "classic" | "sac" = sacId
      ? "sac"
      : issuer
        ? "classic"
        : "native";
    const address = sacId ?? issuer ?? null;
    const displayIssuer =
      kind === "native"
        ? "Native (Stellar)"
        : knownLabel
          ? knownLabel
          : truncateAddress(address ?? "", 4);

    parsed.push({
      id: `${code}:${address ?? "native"}`,
      code,
      kind,
      address,
      displayIssuer,
      isKnownLabel: Boolean(knownLabel) || kind === "native",
      volume,
      opCount,
    });
  }

  const totalOps = parsed.reduce((sum, item) => sum + item.opCount, 0);

  return sortAssetLeaderboard(
    parsed.map((item) => ({
      ...item,
      sharePercent:
        totalOps > 0
          ? Number(((item.opCount / totalOps) * 100).toFixed(2))
          : 0,
    })),
    "volume",
    "desc",
  );
}

export function sortAssetLeaderboard(
  entries: readonly AssetLeaderboardEntry[],
  sortKey: AssetLeaderboardSortKey = "volume",
  direction: SortDirection = "desc",
): AssetLeaderboardEntry[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    if (sortKey === "code") {
      const cmp = a.code.localeCompare(b.code);
      if (cmp !== 0) return cmp * factor;
    } else if (sortKey === "volume") {
      if (a.volume !== b.volume) return (a.volume - b.volume) * factor;
    } else if (sortKey === "opCount") {
      if (a.opCount !== b.opCount) return (a.opCount - b.opCount) * factor;
    } else if (sortKey === "share") {
      if (a.sharePercent !== b.sharePercent) {
        return (a.sharePercent - b.sharePercent) * factor;
      }
    }
    return a.id.localeCompare(b.id);
  });
}

export const FIXTURE_ASSET_LEADERBOARD_ROWS: readonly RawAssetLeaderboardRow[] = [
  {
    asset_code: "XLM",
    amount: "148500000",
    op_count: 612000,
    issuer_label: "Native (Stellar)",
  },
  {
    asset_code: "USDC",
    asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    amount: "92400000",
    op_count: 418000,
    issuer_label: "Circle USDC",
  },
  {
    asset_code: "USDC",
    sac_contract_id: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    amount: "38100000",
    op_count: 194000,
    issuer_label: "USDC SAC",
  },
  {
    asset_code: "EURC",
    asset_issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
    amount: "12900000",
    op_count: 74500,
    issuer_label: "Circle EURC",
  },
  {
    asset_code: "AQUA",
    asset_issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
    amount: "540000000",
    op_count: 129000,
    issuer_label: "Aquarius",
  },
  {
    asset_code: "YUSDC",
    asset_issuer: "GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF",
    amount: "8300000",
    op_count: 41200,
    issuer_label: "Ultra Capital yUSDC",
  },
  {
    asset_code: "SHX",
    asset_issuer: "GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH",
    amount: "67500000",
    op_count: 35800,
    issuer_label: "Stronghold SHx",
  },
  {
    asset_code: "BLND",
    sac_contract_id: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    amount: "19400000",
    op_count: 52100,
  },
  {
    asset_code: "VELO",
    asset_issuer: "GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M",
    amount: "24100000",
    op_count: 28900,
  },
];
