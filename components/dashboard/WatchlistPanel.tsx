"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Button } from "@/components/ui/button";
import { NOTES_UPDATED_EVENT, hasNote, readNotesFromStorage, type EntityNote } from "@/lib/notes";
import { formatActivityDelta, resolveWatchlistBadge } from "@/lib/watchlist-delta";
import { clearImportedEntries, importWatchlistText, type ImportSkip } from "@/lib/watchlist-import";
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
import { findResearchNote } from "@/lib/research-notes";
import { useResearchNotes } from "@/components/dashboard/useResearchNotes";

export function WatchlistPanel() {
  const { data, period, flowViewEnabled, focusWatchedEntity, network } = useDashboard();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState<EntityNote[]>([]);
  const [skipped, setSkipped] = useState<ImportSkip[]>([]);
  const [importStatus, setImportStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(readWatchlistFromStorage());
    setReady(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(readNotesFromStorage());
    const onNotesUpdated = () => setNotes(readNotesFromStorage());
    window.addEventListener(NOTES_UPDATED_EVENT, onNotesUpdated);
    return () => window.removeEventListener(NOTES_UPDATED_EVENT, onNotesUpdated);
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
  const skipCounts = skipped.reduce<Record<string, number>>((counts, item) => {
    counts[item.reason] = (counts[item.reason] ?? 0) + 1;
    return counts;
  }, {});

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

  const handleImport = async (file: File | null) => {
    if (!file) return;
    const format = file.name.toLowerCase().endsWith(".csv")
      ? "csv"
      : file.name.toLowerCase().endsWith(".txt")
        ? "txt"
        : null;
    if (!format || file.size > 1_000_000) {
      setImportStatus("Choose a CSV or TXT file no larger than 1 MB.");
      setSkipped([]);
      return;
    }
    try {
      const result = importWatchlistText(await file.text(), format, entries);
      const overLimit = result.skipped.filter((item) => item.reason.includes("Watchlist limit")).length;
      setEntries(result.entries);
      setSkipped(result.skipped);
      setImportStatus(
        `Imported ${result.imported} address(es); skipped ${result.skipped.length} row(s). ` +
          `Watchlist: ${result.entries.length}/${WATCHLIST_LIMIT}.` +
          (overLimit ? ` ${overLimit} row(s) exceeded the ${WATCHLIST_LIMIT}-entry limit.` : ""),
      );
    } catch {
      setImportStatus("Could not read that file. Try another CSV or TXT file.");
      setSkipped([]);
    }
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          Import CSV/TXT
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          aria-label="Address list file"
          className="sr-only"
          onChange={(event) => {
            void handleImport(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!entries.some((entry) => entry.origin === "import")}
          onClick={() => {
            const count = entries.filter((entry) => entry.origin === "import").length;
            setEntries(clearImportedEntries(entries));
            setSkipped([]);
            setImportStatus(`Cleared ${count} imported address(es).`);
          }}
        >
          Clear imported
        </Button>
        <span className="text-xs text-zinc-500">Up to {WATCHLIST_LIMIT} total; address column only.</span>
      </div>
      {importStatus ? <p role="status" className="mt-2 text-xs text-zinc-300">{importStatus}</p> : null}
      {skipped.length > 0 ? (
        <div className="mt-2 text-xs text-amber-200">
          <p>Skipped rows by reason: {Object.entries(skipCounts).map(([reason, count]) => `${reason} (${count})`).join("; ")}.</p>
          <ul className="list-inside list-disc">
            {skipped.slice(0, 10).map((item) => (
              <li key={item.row}>Row {item.row}: {item.reason}</li>
            ))}
          </ul>
          {skipped.length > 10 ? <p>And {skipped.length - 10} more skipped rows.</p> : null}
        </div>
      ) : null}

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
                  <span className="flex items-center gap-1.5 truncate text-sm text-zinc-100">
                    <span className="truncate">{entry.label}</span>
                    {hasNote(notes, entry.address, network) ? (
                      <span
                        aria-label="Has a research note"
                        title="Has a research note"
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-stellar"
                      />
                    ) : null}
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
