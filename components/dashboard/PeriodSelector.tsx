"use client";

import { useCallback, useRef } from "react";
import { PERIOD_OPTIONS } from "@/lib/periods";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export function PeriodSelector() {
  const { period, setPeriod, comparePeriod, setComparePeriod } = useDashboard();
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const options = PERIOD_OPTIONS;
      const currentIndex = options.findIndex((o) => o.value === period);
      let nextIndex: number | null = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % options.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + options.length) % options.length;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        const nextValue = options[nextIndex].value;
        setPeriod(nextValue);
        const buttons =
          groupRef.current?.querySelectorAll<HTMLButtonElement>("[role=radio]");
        buttons?.[nextIndex]?.focus();
      }
    },
    [period, setPeriod],
  );

  return (
    <div className="space-y-2">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Time period"
        className="flex flex-wrap gap-2"
        onKeyDown={handleKeyDown}
      >
        {PERIOD_OPTIONS.map((option) => (
          <Button
            key={option.value}
            role="radio"
            aria-checked={period === option.value}
            variant={period === option.value ? "default" : "outline"}
            size="sm"
            tabIndex={period === option.value ? 0 : -1}
            onClick={() => setPeriod(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <label className="flex items-center justify-end gap-2 text-xs text-text-secondary">
        Compare with
        <select
          value={comparePeriod ?? ""}
          onChange={(event) =>
            setComparePeriod(
              event.target.value ? (event.target.value as typeof period) : null,
            )
          }
          className="rounded-md border border-border bg-background px-2 py-1.5 text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <option value="">Off</option>
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
