"use client";

import { useCallback, useRef } from "react";
import { TREEMAP_VIEWS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export function TreemapViewSelector() {
  const { treemapView, setTreemapView } = useDashboard();
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const options = TREEMAP_VIEWS;
      const currentIndex = options.findIndex((o) => o.id === treemapView);
      let nextIndex: number | null = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % options.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + options.length) % options.length;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        const nextValue = options[nextIndex].id;
        setTreemapView(nextValue);
        const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>("[role=radio]");
        buttons?.[nextIndex]?.focus();
      }
    },
    [treemapView, setTreemapView],
  );

  const activeView = TREEMAP_VIEWS.find((view) => view.id === treemapView);

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Hierarchy view"
        className="flex flex-wrap gap-2"
        onKeyDown={handleKeyDown}
      >
        {TREEMAP_VIEWS.map((view) => (
          <Button
            key={view.id}
            role="radio"
            aria-checked={treemapView === view.id}
            variant={treemapView === view.id ? "default" : "outline"}
            size="sm"
            tabIndex={treemapView === view.id ? 0 : -1}
            onClick={() => setTreemapView(view.id)}
          >
            {view.label}
          </Button>
        ))}
      </div>
      {activeView ? (
        <p className="text-xs text-text-muted">{activeView.description}</p>
      ) : null}
    </div>
  );
}
