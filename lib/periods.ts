import { z } from "zod";
import type { Period } from "@/lib/types";

export const MAX_CUSTOM_RANGE_DAYS = 90;

const UTC_DATE_STRING_SCHEMA = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected UTC date in YYYY-MM-DD format");

export interface CustomUtcDateRange {
  startInput: string;
  endInput: string;
  start: Date;
  end: Date;
  days: number;
}

export function parseCustomUtcDateRange(
  startParam: string | null | undefined,
  endParam: string | null | undefined,
):
  | { ok: true; range: CustomUtcDateRange | null }
  | { ok: false; code: "INVALID_DATE_RANGE"; message: string } {
  const rawStart = startParam?.trim() ?? "";
  const rawEnd = endParam?.trim() ?? "";

  if (!rawStart && !rawEnd) {
    return { ok: true, range: null };
  }

  if (!rawStart || !rawEnd) {
    return {
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: "Both start and end UTC dates (YYYY-MM-DD) are required for a custom range.",
    };
  }

  const startCheck = UTC_DATE_STRING_SCHEMA.safeParse(rawStart);
  const endCheck = UTC_DATE_STRING_SCHEMA.safeParse(rawEnd);
  if (!startCheck.success || !endCheck.success) {
    return {
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: "Custom range dates must be valid YYYY-MM-DD UTC dates.",
    };
  }

  const [sYear, sMonth, sDay] = rawStart.split("-").map(Number);
  const [eYear, eMonth, eDay] = rawEnd.split("-").map(Number);

  const start = new Date(Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay, 23, 59, 59, 999));

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== rawStart ||
    end.toISOString().slice(0, 10) !== rawEnd
  ) {
    return {
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: "Custom range contains an invalid calendar date.",
    };
  }

  if (start.getTime() > end.getTime()) {
    return {
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: "Custom range start date must not be after end date.",
    };
  }

  const days =
    Math.floor((startOfDayUTC(end).getTime() - start.getTime()) / 86_400_000) +
    1;
  if (days > MAX_CUSTOM_RANGE_DAYS) {
    return {
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: `Custom UTC range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days (requested ${days} days).`,
    };
  }

  return {
    ok: true,
    range: {
      startInput: rawStart,
      endInput: rawEnd,
      start,
      end,
      days,
    },
  };
}

export interface PeriodRange {
  period: Period;
  start: Date;
  end: Date;
  label: string;
}

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "1d", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "month", label: "This Month" },
];

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
  return (
    value === "1d" || value === "7d" || value === "30d" || value === "month"
  );
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
