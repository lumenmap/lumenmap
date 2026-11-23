/**
 * Ranked payment volume. Amounts stay in their own units.
 * A row whose amount cannot be parsed is dropped and counted.
 * Volumes are never converted to a common currency.
 */

export type LeaderboardKind = "native" | "classic" | "sac";

export type LeaderboardRow = {
  code: string;
  kind: LeaderboardKind;
  issuer: string | null;
  volume: number;
  opCount: number;
  share: number;
};

export type LeaderboardResult =
  | { status: "ready"; rows: LeaderboardRow[]; dropped: number }
  | { status: "unavailable"; reason: string };

export type LeaderboardSortKey = "code" | "issuer" | "volume" | "opCount" | "share";

type InputRow = {
  asset?: { type?: string; code?: string; issuer?: string };
  amount?: unknown;
  opCount?: unknown;
};

function kindOf(type: string, issuer: string | undefined): LeaderboardKind | null {
  if (type === "native") return "native";
  if (type !== "issued" || !issuer) return null;
  if (issuer.startsWith("C")) return "sac";
  if (issuer.startsWith("G")) return "classic";
  return null;
}

function volumeOf(amount: unknown): number | null {
  if (typeof amount === "number") {
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }
  if (typeof amount !== "string" || amount.trim() === "") return null;
  const value = Number(amount);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function rankAssetVolumes(input: unknown): LeaderboardResult {
  if (!Array.isArray(input)) {
    return { status: "unavailable", reason: "Asset volume rows are unavailable." };
  }
  const parsed: Omit<LeaderboardRow, "share">[] = [];
  let dropped = 0;
  for (const item of input) {
    if (!item || typeof item !== "object") {
      dropped += 1;
      continue;
    }
    const row = item as InputRow;
    const type = row.asset?.type ?? "";
    const kind = kindOf(type, row.asset?.issuer);
    const volume = volumeOf(row.amount);
    const opCount = row.opCount;
    if (
      !kind ||
      volume === null ||
      typeof opCount !== "number" ||
      !Number.isInteger(opCount) ||
      opCount < 0
    ) {
      dropped += 1;
      continue;
    }
    parsed.push({
      code: kind === "native" ? "XLM" : (row.asset?.code ?? ""),
      kind,
      issuer: kind === "native" ? null : (row.asset?.issuer ?? null),
      volume,
      opCount,
    });
  }
  if (parsed.length === 0) {
    return {
      status: "unavailable",
      reason: "No asset row had a usable amount.",
    };
  }
  const total = parsed.reduce((sum, row) => sum + row.volume, 0);
  const rows = parsed
    .map((row) => ({ ...row, share: total === 0 ? 0 : row.volume / total }))
    .sort((a, b) => b.volume - a.volume || a.code.localeCompare(b.code));
  return { status: "ready", rows, dropped };
}

export function sortLeaderboard(
  rows: LeaderboardRow[],
  key: LeaderboardSortKey,
  direction: "asc" | "desc",
): LeaderboardRow[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = key === "issuer" ? (a.issuer ?? "") : a[key];
    const right = key === "issuer" ? (b.issuer ?? "") : b[key];
    if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
    return String(left).localeCompare(String(right)) * factor;
  });
}
