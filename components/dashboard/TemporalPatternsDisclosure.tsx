// "use client"

import { useEffect, useRef } from "react";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { HourOfWeekHeatmap } from "@/components/dashboard/HourOfWeekHeatmap";
import { BarChart3 } from "lucide-react";

/**
 * Disclosure component that wraps temporal heatmaps.
 * On mobile (width < 640px) it starts collapsed.
 * On larger screens it starts expanded for better visibility.
 * The open state is persisted in sessionStorage under the key
 * "temporalPatternsOpen" so that navigation within the app
 * restores the user's preference.
 */
export function TemporalPatternsDisclosure() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Initialise open state based on viewport width or persisted value
  useEffect(() => {
    const saved = sessionStorage.getItem("temporalPatternsOpen");
    const shouldBeOpen = saved !== null ? saved === "true" : window.innerWidth >= 640;
    if (detailsRef.current) {
      detailsRef.current.open = shouldBeOpen;
    }
  }, []);

  // Persist state changes
  const onToggle = () => {
    if (detailsRef.current) {
      sessionStorage.setItem("temporalPatternsOpen", detailsRef.current.open.toString());
    }
  };

  return (
    <details ref={detailsRef} className="group" onToggle={onToggle}>
      <summary className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50">
        <BarChart3 className="h-5 w-5 text-cyan-400" />
        Temporal patterns
      </summary>
      <div className="mt-2 space-y-4">
        {/* Heatmaps retain their own loading and error handling */}
        <ActivityHeatmap />
        <HourOfWeekHeatmap />
      </div>
    </details>
  );
}
