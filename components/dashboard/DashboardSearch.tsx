"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Badge } from "@/components/ui/badge";
import {
  buildSearchIndex,
  searchIndex,
  type MatchSpan,
  type SearchResult,
} from "@/lib/search";
import { SHORTCUT_KEYS } from "@/lib/shortcuts";
import { cn, truncateAddress } from "@/lib/utils";

function resultTypeBadge(type: SearchResult["type"]): string {
  switch (type) {
    case "account":
      return "Account";
    case "contract":
      return "Contract";
    case "protocol":
      return "Protocol";
    case "asset":
      return "Asset";
    case "category":
      return "Category";
    default:
      return type;
  }
}

/** Highlights `spans` within `label` (as returned on `SearchResult.labelMatchSpans`). */
function HighlightedLabel({ label, spans }: { label: string; spans?: Array<[number, number]> }) {
  if (!spans || spans.length === 0) {
    return <>{label}</>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  spans.forEach(([start, end], i) => {
    if (start > cursor) {
      nodes.push(label.slice(cursor, start));
    }
    nodes.push(
      <mark key={i} className="rounded bg-stellar/30 text-inherit">
        {label.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < label.length) {
    nodes.push(label.slice(cursor));
  }
  return <>{nodes}</>;
}

/**
 * How long to wait after the last keystroke before re-running the search.
 * The search itself is synchronous (an in-memory index, no network), so
 * this isn't masking request latency — it exists purely so a fast typist
 * doesn't re-run the (now typo-tolerant, and therefore pricier) ranking on
 * every single keystroke against the full registry.
 */
export const SEARCH_DEBOUNCE_MS = 150;

export function DashboardSearch() {
  const {
    data,
    isLoading,
    searchQuery: rawSearchQuery,
    setSearchQuery,
    selectSearchResult,
  } = useDashboard();
  const searchQuery = rawSearchQuery ?? "";
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  const index = useMemo(
    () => buildSearchIndex(data),
    [data],
  );

  // Debounced so a fast typist doesn't re-run ranking on every keystroke.
  // The cleanup clears a still-pending timer whenever the query changes
  // again first — the nearest thing to "cancel" a synchronous computation
  // that never actually started.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const results = useMemo(
    () => searchIndex(index, debouncedQuery),
    [index, debouncedQuery],
  );

  // True while the debounced query has not caught up with the typed query;
  // the panel shows a "Searching…" status instead of stale results.
  const pending = searchQuery !== debouncedQuery;

  const flatResults = useMemo(
    () => pending ? [] : results.groups.flatMap((group) => group.results),
    [pending, results],
  );

  // Derive a clamped active index so query changes never leave a stale cursor.
  const safeActiveIndex =
    flatResults.length === 0
      ? 0
      : Math.min(activeIndex, flatResults.length - 1);
  const showPanel = !dismissed && searchQuery.trim().length > 0;

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setDismissed(true);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!showPanel || !listRef.current) {
      return;
    }
    const active = listRef.current.querySelector<HTMLElement>(
      `[data-search-index="${safeActiveIndex}"]`,
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [safeActiveIndex, showPanel, flatResults.length]);

  const handleSelect = (result: SearchResult) => {
    selectSearchResult(result);
    setSearchQuery("");
    setDismissed(true);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;

    const keyboardResults = pending
      ? searchIndex(index, searchQuery).groups.flatMap((group) => group.results)
      : flatResults;
    if (pending) setDebouncedQuery(searchQuery);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => {
        const base =
          keyboardResults.length === 0
            ? 0
            : Math.min(current, keyboardResults.length - 1);
        return keyboardResults.length === 0
          ? 0
          : Math.min(base + 1, keyboardResults.length - 1);
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => {
        const base =
          keyboardResults.length === 0
            ? 0
            : Math.min(current, keyboardResults.length - 1);
        return Math.max(base - 1, 0);
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const target = keyboardResults[Math.min(activeIndex, keyboardResults.length - 1)];
      if (target) {
        handleSelect(target);
      }
      return;
    }

  };

  // Precompute flat index offsets per group for stable option ids.
  const groupOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const group of results.groups) {
      offsets.push(running);
      running += group.results.length;
    }
    return offsets;
  }, [results.groups]);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <label htmlFor={inputId} className="sr-only">
        Search loaded accounts, contracts, assets, and protocols
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          id={inputId}
          type="search"
          role="combobox"
          data-testid="dashboard-search-input"
          aria-expanded={showPanel}
          aria-controls={`${inputId}-listbox`}
          aria-autocomplete="list"
          aria-keyshortcuts={SHORTCUT_KEYS.focusSearch}
          aria-activedescendant={
            showPanel && flatResults[safeActiveIndex]
              ? `${inputId}-option-${safeActiveIndex}`
              : undefined
          }
          autoComplete="off"
          spellCheck={false}
          placeholder="Search address, contract, asset, or protocol…"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setDismissed(false);
            setActiveIndex(0);
          }}
          onFocus={() => setDismissed(false)}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-10 w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-10 pr-10 text-sm text-zinc-100",
            "placeholder:text-zinc-500 focus:border-stellar/50 focus:outline-none focus:ring-2 focus:ring-stellar/40",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        {searchQuery ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setSearchQuery("");
              setDismissed(true);
              setActiveIndex(0);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : isLoading && !data ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
        ) : null}
      </div>

      {showPanel ? (
        <div
          className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-white/10 bg-[#12151d] shadow-2xl shadow-black/50"
          role="listbox"
          id={`${inputId}-listbox`}
        >
          {pending ? (
            <div className="px-4 py-6 text-sm text-zinc-400" role="status">
              Searching…
            </div>
          ) : results.total === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400">
              No matches in loaded data for{" "}
              <span className="font-medium text-zinc-200">
                “{results.query}”
              </span>
              .
            </div>
          ) : (
            <ul ref={listRef} className="py-2">
              {results.groups.map((group, groupIndex) => (
                <li key={group.type} className="list-none">
                  <div className="sticky top-0 bg-[#12151d]/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur">
                    {group.label}
                  </div>
                  <ul>
                    {group.results.map((result, resultIndex) => {
                      const indexForItem =
                        (groupOffsets[groupIndex] ?? 0) + resultIndex;
                      const isActive = indexForItem === safeActiveIndex;

                      return (
                        <li key={result.key} className="list-none">
                          <button
                            type="button"
                            id={`${inputId}-option-${indexForItem}`}
                            role="option"
                            aria-selected={isActive}
                            data-search-index={indexForItem}
                            className={cn(
                              "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                              isActive
                                ? "bg-stellar/20 text-white"
                                : "text-zinc-200 hover:bg-white/5",
                            )}
                            onMouseEnter={() => setActiveIndex(indexForItem)}
                            onClick={() => handleSelect(result)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  <HighlightedLabel label={result.label} spans={result.labelMatchSpans} />
                                </span>
                                <Badge variant="secondary" className="shrink-0">
                                  {resultTypeBadge(result.type)}
                                </Badge>
                              </div>
                              {result.subtitle ? (
                                <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                                  {result.subtitle}
                                </p>
                              ) : null}
                              {result.type === "asset" && result.issuer ? (
                                <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                                  Issuer {truncateAddress(result.issuer, 6)}
                                </p>
                              ) : null}
                            </div>
                            {typeof result.opCount === "number" ? (
                              <span className="shrink-0 text-xs text-zinc-500">
                                {result.opCount.toLocaleString("en-US")} ops
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
