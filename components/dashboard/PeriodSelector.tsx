"use client";

import { useCallback, useRef, useState } from "react";
import {
  MAX_CUSTOM_RANGE_DAYS,
  PERIOD_OPTIONS,
  parseCustomUtcDateRange,
} from "@/lib/periods";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export function PeriodSelector() {
  const { period, setPeriod, comparePeriod, setComparePeriod } = useDashboard();
  const groupRef = useRef<HTMLDivElement>(null);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);

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

  const applyCustomUtcRange = () => {
    const parsed = parseCustomUtcDateRange(customStart, customEnd);
    if (!parsed.ok) {
      setRangeError(parsed.message);
      return;
    }
    setRangeError(null);
    if (typeof window !== "undefined" && parsed.range) {
      const url = new URL(window.location.href);
      url.searchParams.set("start", parsed.range.startInput);
      url.searchParams.set("end", parsed.range.endInput);
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div className="max-w-full space-y-2">
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
            aria-checked={period === option.value && !showCustomRange}
            variant={
              period === option.value && !showCustomRange
                ? "default"
                : "outline"
            }
            size="sm"
            tabIndex={period === option.value ? 0 : -1}
            onClick={() => {
              setShowCustomRange(false);
              setRangeError(null);
              setPeriod(option.value);
            }}
          >
            {option.label}
          </Button>
        ))}
        <Button
          type="button"
          data-testid="custom-utc-range-toggle"
          aria-expanded={showCustomRange}
          variant={showCustomRange ? "default" : "outline"}
          size="sm"
          onClick={() => setShowCustomRange((prev) => !prev)}
        >
          Custom UTC
        </Button>
      </div>

      {showCustomRange && (
        <div
          data-testid="custom-utc-range-picker"
          className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-zinc-300"
        >
          <label className="flex items-center gap-1">
            <span>Start (UTC)</span>
            <input
              type="date"
              data-testid="custom-utc-start"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded border border-white/15 bg-zinc-900 px-2 py-1 font-mono text-xs text-white"
            />
          </label>
          <label className="flex items-center gap-1">
            <span>End (UTC)</span>
            <input
              type="date"
              data-testid="custom-utc-end"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded border border-white/15 bg-zinc-900 px-2 py-1 font-mono text-xs text-white"
            />
          </label>
          <Button
            type="button"
            size="sm"
            data-testid="custom-utc-apply"
            onClick={applyCustomUtcRange}
          >
            Apply (max {MAX_CUSTOM_RANGE_DAYS}d)
          </Button>
          {rangeError && (
            <p
              role="alert"
              data-testid="custom-utc-error"
              className="w-full text-xs text-rose-400"
            >
              {rangeError}
            </p>
          )}
        </div>
      )}

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
