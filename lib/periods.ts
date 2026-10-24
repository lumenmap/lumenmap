import type { Period } from "@/lib/types";

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
