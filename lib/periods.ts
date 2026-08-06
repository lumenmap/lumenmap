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
  return value === "1d" || value === "7d" || value === "30d" || value === "month";
}
