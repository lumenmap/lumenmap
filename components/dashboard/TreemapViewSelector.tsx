"use client";

import { TREEMAP_VIEWS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export function TreemapViewSelector() {
  const { treemapView, setTreemapView } = useDashboard();
  const activeView = TREEMAP_VIEWS.find((view) => view.id === treemapView);

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div className="flex flex-wrap gap-2">
        {TREEMAP_VIEWS.map((view) => (
          <Button
            key={view.id}
            variant={treemapView === view.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTreemapView(view.id)}
          >
            {view.label}
          </Button>
        ))}
      </div>
      {activeView ? (
        <p className="text-xs text-zinc-500">{activeView.description}</p>
      ) : null}
    </div>
  );
}
