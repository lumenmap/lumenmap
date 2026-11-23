"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { encodeCustomPeriod, MAX_CUSTOM_RANGE_DAYS } from "@/lib/periods";
import type { Period } from "@/lib/types";

interface CustomDateRangePickerProps {
  onApply: (period: Period) => void;
  onCancel: () => void;
}

/**
 * Custom UTC date-range picker for precise research windows.
 * Issue #444: Enables exact date ranges (e.g., SCF round dates) beyond 1d/7d/30d/month presets.
 */
export function CustomDateRangePicker({ onApply, onCancel }: CustomDateRangePickerProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const startInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus start date on mount
    startInputRef.current?.focus();
  }, []);

  const validateAndApply = () => {
    setError("");

    if (!startDate || !endDate) {
      setError("Both start and end dates are required");
      return;
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    // Validate dates
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Invalid date format");
      return;
    }

    // Check inverted range
    if (start > end) {
      setError("Start date must be before or equal to end date");
      return;
    }

    // Check max span
    const spanDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
    if (spanDays > MAX_CUSTOM_RANGE_DAYS) {
      setError(`Date range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`);
      return;
    }

    const customPeriod = encodeCustomPeriod(start, end);
    onApply(customPeriod);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      validateAndApply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div 
      className="absolute left-0 top-full z-50 mt-2 rounded-lg border border-border bg-background p-4 shadow-lg"
      role="dialog"
      aria-label="Custom date range picker"
      onKeyDown={handleKeyDown}
    >
      <div className="mb-3 space-y-3">
        <div>
          <label htmlFor="start-date" className="mb-1 block text-sm font-medium">
            Start Date (UTC)
          </label>
          <input
            ref={startInputRef}
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="mb-1 block text-sm font-medium">
            End Date (UTC)
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="text-xs text-text-secondary mb-3">
        Maximum range: {MAX_CUSTOM_RANGE_DAYS} days
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={validateAndApply}>
          Apply
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
