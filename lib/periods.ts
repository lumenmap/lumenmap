import type { Period, CustomDateRange } from "@/lib/types";

export interface PeriodRange {
  period: Period;
  start: Date;
  end: Date;
  label: string;
}

export const PERIOD_OPTIONS: { value: Exclude<Period, `custom:${string}:${string}`>; label: string }[] = [
  { value: "1d", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "month", label: "This Month" },
];

/** Maximum allowed span for custom date ranges (90 days) */
export const MAX_CUSTOM_RANGE_DAYS = 90;

function startOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function endOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function subDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86_400_000);
}

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

export function resolvePeriod(period: Period, now = new Date()): PeriodRange {
  // Check if it's a custom date range
  if (period.startsWith("custom:")) {
    const parsed = parseCustomPeriod(period);
    if (parsed.ok) {
      return {
        period,
        start: parsed.range.start,
        end: parsed.range.end,
        label: formatCustomRangeLabel(parsed.range.start, parsed.range.end),
      };
    }
    // Fall back to 1d for invalid custom ranges
    return resolvePeriod("1d", now);
  }

  const end = endOfDayUTC(now);

  switch (period) {
    case "1d":
      return {
        period,
        start: startOfDayUTC(now),
        end,
        label: "Today",
      };
    case "7d":
      return {
        period,
        start: startOfDayUTC(subDaysUTC(now, 6)),
        end,
        label: "Last 7 Days",
      };
    case "30d":
      return {
        period,
        start: startOfDayUTC(subDaysUTC(now, 29)),
        end,
        label: "Last 30 Days",
      };
    case "month":
      return {
        period,
        start: startOfMonthUTC(now),
        end: endOfMonthUTC(now),
        label: "This Month",
      };
    default:
      return resolvePeriod("1d", now);
  }
}

export function isValidPeriod(value: string | null): value is Period {
  if (!value) return false;
  if (value === "1d" || value === "7d" || value === "30d" || value === "month") {
    return true;
  }
  if (value.startsWith("custom:")) {
    const parsed = parseCustomPeriod(value);
    return parsed.ok;
  }
  return false;
}

/**
 * Parses a custom period string (format: "custom:YYYY-MM-DD:YYYY-MM-DD")
 * Returns parsed range or error details.
 */
export function parseCustomPeriod(
  period: string,
): 
  | { ok: true; range: CustomDateRange }
  | { ok: false; error: string; code: string } {
  const match = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(period);
  
  if (!match) {
    return {
      ok: false,
      error: "Invalid custom period format. Use custom:YYYY-MM-DD:YYYY-MM-DD",
      code: "INVALID_FORMAT",
    };
  }

  const [, startStr, endStr] = match;
  const start = new Date(`${startStr}T00:00:00.000Z`);
  const end = new Date(`${endStr}T23:59:59.999Z`);

  // Validate dates are valid
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      ok: false,
      error: "Invalid date values in custom period",
      code: "INVALID_DATE",
    };
  }

  // Reject inverted ranges
  if (start > end) {
    return {
      ok: false,
      error: "Start date must be before or equal to end date",
      code: "INVERTED_RANGE",
    };
  }

  // Check max span (90 days)
  const spanDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  if (spanDays > MAX_CUSTOM_RANGE_DAYS) {
    return {
      ok: false,
      error: `Date range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`,
      code: "RANGE_TOO_LONG",
    };
  }

  return {
    ok: true,
    range: { start, end },
  };
}

/**
 * Encodes a custom date range into a period string.
 */
export function encodeCustomPeriod(start: Date, end: Date): Period {
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  return `custom:${startStr}:${endStr}`;
}

/**
 * Formats a custom range for display (e.g., "Jan 1 - Jan 15, 2024")
 */
function formatCustomRangeLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric',
    timeZone: 'UTC'
  };
  
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  
  if (startYear === endYear) {
    const startMonth = start.getUTCMonth();
    const endMonth = end.getUTCMonth();
    
    if (startMonth === endMonth) {
      // Same month and year: "Jan 1-15, 2024"
      return `${start.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' }).replace(/,.*/, '')} - ${end.getUTCDate()}, ${endYear}`;
    }
    // Same year: "Jan 1 - Feb 15, 2024"
    return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}, ${endYear}`;
  }
  
  // Different years: "Dec 20, 2023 - Jan 5, 2024"
  return `${start.toLocaleDateString('en-US', { ...opts, year: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric', timeZone: 'UTC' })}`;
}

const PREVIOUS_PERIOD_LABELS: Record<Period, string> = {
  "1d": "Previous day",
  "7d": "Previous 7 days",
  "30d": "Previous 30 days",
  month: "Previous month",
};

/**
 * An instant inside the equal-length window immediately before the window
 * `resolvePeriod(period, now)` resolves to.
 *
 * `resolvePeriod` always anchors "now" at the *end* of the resolved window,
 * so the last instant before the active window (`current.start - 1ms`) is
 * itself anchored by `resolvePeriod` to a window of the same length that ends
 * exactly where the active window begins: yesterday for `1d`, the seven days
 * before the current seven for `7d`, and so on.
 */
export function previousPeriodAnchor(period: Period, now = new Date()): Date {
  const current = resolvePeriod(period, now);
  return new Date(current.start.getTime() - 1);
}

/**
 * The equal-length window immediately before the active window for
 * `period`. Used by the treemap period-over-period diff mode
 * (issue #447): every supported period has a well-defined predecessor of
 * the same length, so a tile's delta always compares like with like.
 */
export function resolvePreviousPeriodRange(
  period: Period,
  now = new Date(),
): PeriodRange {
  return {
    ...resolvePeriod(period, previousPeriodAnchor(period, now)),
    label: PREVIOUS_PERIOD_LABELS[period],
  };
}
