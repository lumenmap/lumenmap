"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Button } from "@/components/ui/button";
import { formatActivityDelta, resolveWatchlistBadge } from "@/lib/watchlist-delta";
import {
  WATCHLIST_LIMIT,
  addWatchlistEntry,
  moveWatchlistEntry,
  readWatchlistFromStorage,
  rememberWatchlistOps,
  removeWatchlistEntry,
  writeWatchlistToStorage,
  type WatchlistEntry,
} from "@/lib/watchlist";
import { formatNumber } from "@/lib/utils";

export function WatchlistPanel() {
  const { data, period, flowViewEnabled, focusWatchedEntity } = useDashboard();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(readWatchlistFromStorage());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeWatchlistToStorage(entries);
  }, [entries, ready]);

  useEffect(() => {
    if (!ready || !data) return;
    const seenAt = new Date().toISOString();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries((current) => {
      let next = current;
      for (const entry of current) {
        const badge = resolveWatchlistBadge({
          address: entry.address,
          kind: entry.kind,
          period: data.period,
          source: data.source,
          treemaps: data.treemaps,
        });
        if (badge.opCount === null) continue;
        next = rememberWatchlistOps(
          next,
          entry.address,
          badge.opCount,
          data.period,
          seenAt,
        );
      }
      return next;
    });
  }, [ready, data, entries]);

  const atLimit = entries.length >= WATCHLIST_LIMIT;

  const handleAdd = () => {
    const result = addWatchlistEntry({ address, label, entries });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAddress("");
    setLabel("");
    setError("");
    setEntries(result.entries);
  };

  return (
    <section
      aria-label="Wallet watchlist"
      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-sm font-medium text-zinc-100">Watchlist</h2>
        <p className="text-xs text-zinc-500">
          {entries.length}/{WATCHLIST_LIMIT} saved in this browser
        </p>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Track up to {WATCHLIST_LIMIT} accounts or contracts. Counts follow the
        active period{flowViewEnabled ? "; opening one also centers Flow ego." : "."}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-zinc-400" htmlFor="watchlist-address">
          Account or contract
          <input
            id="watchlist-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="G… or C…"
            autoComplete="off"
            spellCheck={false}
            disabled={atLimit}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 disabled:opacity-60"
          />
        </label>
        <label className="min-w-0 flex-1 text-xs text-zinc-400" htmlFor="watchlist-label">
          Label
          <input
            id="watchlist-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Optional name"
            disabled={atLimit}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
          />
        </label>
        <Button type="button" onClick={handleAdd} disabled={atLimit}>
          Add
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      {atLimit ? (
        <p role="status" className="mt-3 text-sm text-amber-200">
          Watchlist is full ({WATCHLIST_LIMIT}/{WATCHLIST_LIMIT}). Remove an
          entry before adding another.
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">
          No watched accounts yet. Add a Stellar account or contract to keep
          it here between reloads.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map((entry, index) => {
            const badge = data
              ? resolveWatchlistBadge({
                  address: entry.address,
                  kind: entry.kind,
                  period: data.period,
                  source: data.source,
                  treemaps: data.treemaps,
                })
              : null;
            const opCount = badge?.opCount ?? entry.lastSeenOps ?? null;
            const deltaPercent = badge?.deltaPercent ?? null;
            const deltaClass =
              deltaPercent === null
                ? "text-zinc-500"
                : deltaPercent > 0
                  ? "text-emerald-300"
                  : deltaPercent < 0
                    ? "text-rose-300"
                    : "text-zinc-300";

            return (
              <li
                key={entry.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-800 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar"
                  onClick={() =>
                    focusWatchedEntity({
                      name: entry.label,
                      value: opCount ?? 0,
                      share: 0,
                      meta: {
                        type: entry.kind,
                        id: entry.address,
                        opCount: opCount ?? undefined,
                      },
                    })
                  }
                >
                  <span className="block truncate text-sm text-zinc-100">
                    {entry.label}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-zinc-500">
                    {entry.kind} · {entry.address}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-zinc-300">
                      {opCount === null ? "—" : formatNumber(opCount)} ops
                      <span className="text-zinc-500"> · {period}</span>
                    </span>
                    <span className={deltaClass}>
                      {formatActivityDelta(deltaPercent)} vs prior window
                    </span>
                  </span>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={index === 0}
                    aria-label={`Move ${entry.label} up`}
                    onClick={() =>
                      setEntries(moveWatchlistEntry(entries, entry.id, -1))
                    }
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={index === entries.length - 1}
                    aria-label={`Move ${entry.label} down`}
                    onClick={() =>
                      setEntries(moveWatchlistEntry(entries, entry.id, 1))
                    }
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Remove ${entry.label}`}
                    onClick={() => {
                      setError("");
                      setEntries(removeWatchlistEntry(entry.id, entries));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
