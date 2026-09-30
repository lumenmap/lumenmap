"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { Button } from "@/components/ui/button";
import {
  deleteSavedView,
  exportSavedViewsJson,
  importSavedViewsJson,
  readSavedViewsFromStorage,
  saveCurrentView,
  snapshotSearchFromDashboard,
  writeSavedViewsToStorage,
  type SavedResearchView,
} from "@/lib/saved-research-views";

export function SavedViewsControls() {
  const {
    period,
    metric,
    treemapView,
    activeLevelPath,
    comparePeriod,
    setPeriod,
    setMetric,
    setTreemapView,
    setActiveLevelPath,
    setComparePeriod,
  } = useDashboard();
  const [views, setViews] = useState<SavedResearchView[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setViews(readSavedViewsFromStorage());
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeSavedViewsToStorage(views);
  }, [views, ready]);

  const persist = (next: SavedResearchView[], message: string) => {
    setViews(next);
    setStatus(message);
  };

  const handleSave = () => {
    const search = snapshotSearchFromDashboard({
      period,
      metric,
      view: treemapView,
      path: activeLevelPath,
      comparePeriod,
    });
    const result = saveCurrentView({ name, search, views });
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setName("");
    persist(result.views, `Saved “${result.saved.name}”.`);
  };

  const handleRestore = (view: SavedResearchView) => {
    const params = new URLSearchParams(
      view.search.startsWith("?") ? view.search.slice(1) : view.search,
    );
    const nextPeriod = params.get("period");
    const nextMetric = params.get("metric");
    const nextView = params.get("view");
    const nextCompare = params.get("compare");
    if (nextPeriod) setPeriod(nextPeriod as typeof period);
    if (nextMetric) setMetric(nextMetric as typeof metric);
    if (nextView) setTreemapView(nextView as typeof treemapView);
    setComparePeriod(
      nextCompare ? (nextCompare as NonNullable<typeof comparePeriod>) : null,
    );
    // Path restore is applied via URL sync + DashboardProvider pending segments.
    if (typeof window !== "undefined") {
      const nextSearch = view.search.startsWith("?")
        ? view.search
        : `?${view.search}`;
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${nextSearch}`,
      );
      window.location.reload();
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportSavedViewsJson(views)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lumenmap-saved-views.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Exported saved views JSON.");
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const result = importSavedViewsJson(text, views);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    persist(result.views, `Imported ${result.imported} view(s).`);
  };

  return (
    <section
      aria-label="Saved research views"
      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-xs text-zinc-400">
          Save current view
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Weekly payments drill"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <Button type="button" onClick={handleSave}>
          Save view
        </Button>
        <Button type="button" variant="outline" onClick={handleExport}>
          Export JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
        >
          Import JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            void handleImportFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </div>

      {status && (
        <p role="status" className="mt-3 text-xs text-zinc-400">
          {status}
        </p>
      )}

      {views.length > 0 && (
        <ul className="mt-4 space-y-2">
          {views.map((view) => (
            <li
              key={view.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-100">{view.name}</p>
                <p className="truncate font-mono text-[11px] text-zinc-500">
                  {view.search}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleRestore(view)}
                >
                  Restore
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    persist(deleteSavedView(view.id, views), `Deleted “${view.name}”.`)
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
