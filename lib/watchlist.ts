import {
  isValidStellarAccountId,
  isValidStellarContractId,
  type StellarExpertEntityKind,
} from "@/lib/stellar-expert";
import type { Period } from "@/lib/types";

/** localStorage key. Versioned the same way as saved research views. */
export const WATCHLIST_STORAGE_KEY = "lumenmap:wallet-watchlist:v1";

/** Hard cap from the watchlist issue. The panel states this limit. */
export const WATCHLIST_LIMIT = 20;

export const WATCHLIST_INVALID_ADDRESS =
  "Enter a valid Stellar account (G…) or contract (C…) address.";

export const WATCHLIST_DUPLICATE =
  "That address is already on the watchlist.";

export const WATCHLIST_FULL =
  "Watchlist holds at most 20 accounts and contracts. Remove one to add another.";

export const WATCHLIST_LABEL_TOO_LONG =
  "Label must be 80 characters or fewer.";

export type WatchlistKind = StellarExpertEntityKind;

export type WatchlistEntry = {
  id: string;
  address: string;
  label: string;
  kind: WatchlistKind;
  createdAt: string;
  updatedAt: string;
  /** Last operation count observed for `lastSeenPeriod`, if any. */
  lastSeenOps?: number | null;
  lastSeenPeriod?: Period | null;
  lastSeenAt?: string | null;
};

export type WatchlistFile = {
  version: 1;
  entries: WatchlistEntry[];
};

export type WatchlistStorage = Pick<Storage, "getItem" | "setItem">;

function nowIso(): string {
  return new Date().toISOString();
}

export function createWatchlistId(): string {
  return `watch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeWatchlistAddress(address: string): string {
  return address.trim().toUpperCase();
}

export function normalizeWatchlistLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export function defaultWatchlistLabel(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function resolveWatchlistKind(address: string): WatchlistKind | null {
  if (isValidStellarAccountId(address)) return "account";
  if (isValidStellarContractId(address)) return "contract";
  return null;
}

function isEntry(value: unknown): value is WatchlistEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as WatchlistEntry;
  return (
    typeof entry.id === "string" &&
    typeof entry.address === "string" &&
    typeof entry.label === "string" &&
    (entry.kind === "account" || entry.kind === "contract") &&
    resolveWatchlistKind(entry.address) === entry.kind
  );
}

export function readWatchlistFromStorage(
  storage: WatchlistStorage | null = typeof window !== "undefined"
    ? window.localStorage
    : null,
): WatchlistEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchlistFile;
    if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter(isEntry).slice(0, WATCHLIST_LIMIT);
  } catch {
    return [];
  }
}

export function writeWatchlistToStorage(
  entries: WatchlistEntry[],
  storage: WatchlistStorage | null = typeof window !== "undefined"
    ? window.localStorage
    : null,
): void {
  if (!storage) return;
  const payload: WatchlistFile = {
    version: 1,
    entries: entries.slice(0, WATCHLIST_LIMIT),
  };
  storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(payload));
}

export function addWatchlistEntry(input: {
  address: string;
  label?: string;
  entries: WatchlistEntry[];
  now?: string;
}): { ok: true; entries: WatchlistEntry[]; added: WatchlistEntry } | { ok: false; error: string } {
  if (input.entries.length >= WATCHLIST_LIMIT) {
    return { ok: false, error: WATCHLIST_FULL };
  }

  const address = normalizeWatchlistAddress(input.address);
  const kind = resolveWatchlistKind(address);
  if (!kind) return { ok: false, error: WATCHLIST_INVALID_ADDRESS };

  if (input.entries.some((entry) => entry.address === address)) {
    return { ok: false, error: WATCHLIST_DUPLICATE };
  }

  const provided = normalizeWatchlistLabel(input.label ?? "");
  if (provided.length > 80) {
    return { ok: false, error: WATCHLIST_LABEL_TOO_LONG };
  }

  const stamp = input.now ?? nowIso();
  const added: WatchlistEntry = {
    id: createWatchlistId(),
    address,
    label: provided || defaultWatchlistLabel(address),
    kind,
    createdAt: stamp,
    updatedAt: stamp,
  };

  return { ok: true, entries: [...input.entries, added], added };
}

export function removeWatchlistEntry(
  id: string,
  entries: WatchlistEntry[],
): WatchlistEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

/**
 * Move an entry one step up (-1) or down (+1). Order is the persisted
 * watchlist order. Out-of-range moves return the same array.
 */
export function moveWatchlistEntry(
  entries: WatchlistEntry[],
  id: string,
  direction: -1 | 1,
): WatchlistEntry[] {
  const index = entries.findIndex((entry) => entry.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= entries.length) return entries;
  const next = entries.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function rememberWatchlistOps(
  entries: WatchlistEntry[],
  address: string,
  opCount: number,
  period: Period,
  seenAt: string,
): WatchlistEntry[] {
  let changed = false;
  const next = entries.map((entry) => {
    if (entry.address !== address) return entry;
    if (entry.lastSeenOps === opCount && entry.lastSeenPeriod === period) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      lastSeenOps: opCount,
      lastSeenPeriod: period,
      lastSeenAt: seenAt,
      updatedAt: seenAt,
    };
  });
  return changed ? next : entries;
}
