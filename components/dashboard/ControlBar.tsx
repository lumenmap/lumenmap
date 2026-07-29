"use client";

import { PERIOD_OPTIONS } from "@/lib/periods";
import { TREEMAP_VIEWS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

/**
 * ControlBar
 *
 * Groups the two primary page controls together so they are immediately
 * discoverable beneath the site header:
 *   - Metric view  (Operation Types / Accounts & Contracts)
 *   - Time period  (Today / 7 Days / 30 Days / This Month)
 *
 * The section is labelled as an h2 landmark so keyboard and screen-reader
 * users encounter controls before the treemap in reading order.
 */
export function ControlBar() {
  const { period, setPeriod, treemapView, setTreemapView } = useDashboard();

  const activeView = TREEMAP_VIEWS.find((v) => v.id === treemapView);

  return (
    <section aria-labelledby="controls-heading">
      <h2 id="controls-heading" className="sr-only">
        Dashboard controls
      </h2>

      <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-start sm:gap-6">
        {/* ── Metric view ─────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            View
          </p>
          <div
            role="group"
            aria-label="Metric view"
            className="flex flex-wrap gap-2"
          >
            {TREEMAP_VIEWS.map((view) => (
              <Button
                key={view.id}
                variant={treemapView === view.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTreemapView(view.id)}
                aria-pressed={treemapView === view.id}
              >
                {view.label}
              </Button>
            ))}
          </div>
          {activeView ? (
            <p className="text-xs text-zinc-500">{activeView.description}</p>
          ) : null}
        </div>

        {/* Vertical divider – desktop only */}
        <div
          aria-hidden="true"
          className="hidden w-px self-stretch bg-white/10 sm:block"
        />

        {/* ── Time period ─────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Period
          </p>
          <div
            role="group"
            aria-label="Time period"
            className="flex flex-wrap gap-2"
          >
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={period === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(option.value)}
                aria-pressed={period === option.value}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
