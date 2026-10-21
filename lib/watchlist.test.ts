import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIXTURE_ACCOUNTS, FIXTURE_CONTRACTS } from "@/lib/fixtures/raw-data";
import {
  WATCHLIST_DUPLICATE,
  WATCHLIST_FULL,
  WATCHLIST_INVALID_ADDRESS,
  WATCHLIST_LIMIT,
  WATCHLIST_STORAGE_KEY,
  addWatchlistEntry,
  moveWatchlistEntry,
  readWatchlistFromStorage,
  removeWatchlistEntry,
  writeWatchlistToStorage,
  type WatchlistEntry,
  type WatchlistStorage,
} from "./watchlist";

function memoryStorage(): WatchlistStorage & { snapshot(): string | null } {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    snapshot() {
      return values.get(WATCHLIST_STORAGE_KEY) ?? null;
    },
  };
}

function fakeId(prefix: "G" | "C", n: number): string {
  const safe = "234567ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `${prefix}${"A".repeat(54)}${safe[n % safe.length]}`;
}

describe("watchlist persistence", () => {
  it("rejects invalid addresses, duplicates, and the 21st entry", () => {
    const empty = addWatchlistEntry({
      address: "not-an-address",
      entries: [],
    });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.error, WATCHLIST_INVALID_ADDRESS);

    const first = addWatchlistEntry({
      address: `  ${FIXTURE_ACCOUNTS.kraken.toLowerCase()}  `,
      label: "Kraken",
      entries: [],
      now: "2026-10-21T00:00:00.000Z",
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.added.address, FIXTURE_ACCOUNTS.kraken);
    assert.equal(first.added.kind, "account");
    assert.equal(first.added.label, "Kraken");

    const duplicate = addWatchlistEntry({
      address: FIXTURE_ACCOUNTS.kraken,
      entries: first.entries,
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.error, WATCHLIST_DUPLICATE);

    let entries: WatchlistEntry[] = [];
    for (let n = 0; n < WATCHLIST_LIMIT; n += 1) {
      const added = addWatchlistEntry({
        address: fakeId("G", n + 1),
        entries,
        now: "2026-10-21T00:00:00.000Z",
      });
      assert.equal(added.ok, true);
      if (added.ok) entries = added.entries;
    }
    const overflow = addWatchlistEntry({
      address: FIXTURE_CONTRACTS.soroswap,
      entries,
    });
    assert.equal(overflow.ok, false);
    if (!overflow.ok) assert.equal(overflow.error, WATCHLIST_FULL);
  });

  it("adds, reorders, removes, and round-trips through storage", () => {
    const storage = memoryStorage();
    const kraken = addWatchlistEntry({
      address: FIXTURE_ACCOUNTS.kraken,
      label: "Kraken",
      entries: [],
      now: "2026-10-21T00:00:00.000Z",
    });
    assert.equal(kraken.ok, true);
    if (!kraken.ok) return;

    const contract = addWatchlistEntry({
      address: FIXTURE_CONTRACTS.soroswap,
      label: "Soroswap",
      entries: kraken.entries,
      now: "2026-10-21T00:00:01.000Z",
    });
    assert.equal(contract.ok, true);
    if (!contract.ok) return;
    assert.equal(contract.added.kind, "contract");

    const moved = moveWatchlistEntry(contract.entries, contract.added.id, -1);
    assert.deepEqual(
      moved.map((entry) => entry.label),
      ["Soroswap", "Kraken"],
    );
    assert.equal(moveWatchlistEntry(moved, moved[0].id, -1), moved);

    writeWatchlistToStorage(moved, storage);
    const restored = readWatchlistFromStorage(storage);
    assert.deepEqual(
      restored.map((entry) => entry.address),
      moved.map((entry) => entry.address),
    );

    const removed = removeWatchlistEntry(moved[0].id, restored);
    assert.equal(removed.length, 1);
    assert.equal(removed[0].label, "Kraken");
    writeWatchlistToStorage(removed, storage);
    assert.equal(readWatchlistFromStorage(storage).length, 1);
  });

  it("drops malformed storage instead of throwing", () => {
    const storage = memoryStorage();
    storage.setItem(WATCHLIST_STORAGE_KEY, "{not-json");
    assert.deepEqual(readWatchlistFromStorage(storage), []);

    storage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify({ version: 1, entries: [{ id: 1 }, { address: "nope" }] }),
    );
    assert.deepEqual(readWatchlistFromStorage(storage), []);

    storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ version: 2, entries: [] }));
    assert.deepEqual(readWatchlistFromStorage(storage), []);
  });
});
