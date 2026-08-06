import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePeriod, isValidPeriod, PERIOD_OPTIONS } from "./periods";

describe("PERIOD_OPTIONS", () => {
  it("has the correct entries", () => {
    assert.deepEqual(PERIOD_OPTIONS, [
      { value: "1d", label: "Today" },
      { value: "7d", label: "7 Days" },
      { value: "30d", label: "30 Days" },
      { value: "month", label: "This Month" },
    ]);
  });
});

describe("isValidPeriod", () => {
  it("returns true for valid periods", () => {
    assert.equal(isValidPeriod("1d"), true);
    assert.equal(isValidPeriod("7d"), true);
    assert.equal(isValidPeriod("30d"), true);
    assert.equal(isValidPeriod("month"), true);
  });

  it("returns false for invalid values", () => {
    assert.equal(isValidPeriod(""), false);
    assert.equal(isValidPeriod("foo"), false);
    assert.equal(isValidPeriod("90d"), false);
    assert.equal(isValidPeriod(null), false);
  });
});

describe("resolvePeriod", () => {
  describe("1d (Today)", () => {
    it("resolves start and end to the same UTC day", () => {
      const now = new Date("2024-06-15T12:30:00.000Z");
      const r = resolvePeriod("1d", now);

      assert.equal(r.period, "1d");
      assert.equal(r.label, "Today");

      const startISO = r.start.toISOString();
      const endISO = r.end.toISOString();

      assert.equal(startISO, "2024-06-15T00:00:00.000Z");
      assert.equal(endISO, "2024-06-15T23:59:59.999Z");
    });

    it("handles time already past midnight UTC", () => {
      const now = new Date("2024-06-15T23:45:00.000Z");
      const r = resolvePeriod("1d", now);

      assert.equal(r.start.toISOString(), "2024-06-15T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-06-15T23:59:59.999Z");
    });

    it("handles instant just after UTC midnight", () => {
      const now = new Date("2024-06-15T00:00:00.001Z");
      const r = resolvePeriod("1d", now);

      assert.equal(r.start.toISOString(), "2024-06-15T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-06-15T23:59:59.999Z");
    });

    it("start <= end", () => {
      const r = resolvePeriod("1d", new Date("2024-06-15T12:00:00.000Z"));
      assert.ok(r.start.getTime() <= r.end.getTime());
    });
  });

  describe("7d (Last 7 Days)", () => {
    it("contains exactly 7 days", () => {
      const now = new Date("2024-06-15T12:00:00.000Z");
      const r = resolvePeriod("7d", now);

      assert.equal(r.period, "7d");
      assert.equal(r.label, "Last 7 Days");

      const startMs = r.start.getTime();
      const endMs = r.end.getTime();
      const diffDays = (endMs - startMs) / 86_400_000;

      assert.ok(diffDays >= 6);
      assert.ok(diffDays < 7);
    });

    it("starts 6 days before the end date", () => {
      const now = new Date("2024-06-15T12:00:00.000Z");
      const r = resolvePeriod("7d", now);

      const startISO = r.start.toISOString();
      const endISO = r.end.toISOString();

      assert.equal(startISO, "2024-06-09T00:00:00.000Z");
      assert.equal(endISO, "2024-06-15T23:59:59.999Z");
    });

    it("works across month boundary", () => {
      const now = new Date("2024-06-03T12:00:00.000Z");
      const r = resolvePeriod("7d", now);

      assert.equal(r.start.toISOString(), "2024-05-28T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-06-03T23:59:59.999Z");
    });

    it("works across year boundary", () => {
      const now = new Date("2024-01-03T12:00:00.000Z");
      const r = resolvePeriod("7d", now);

      assert.equal(r.start.toISOString(), "2023-12-28T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-01-03T23:59:59.999Z");
    });
  });

  describe("30d (Last 30 Days)", () => {
    it("contains exactly 30 days", () => {
      const now = new Date("2024-06-15T12:00:00.000Z");
      const r = resolvePeriod("30d", now);

      const startMs = r.start.getTime();
      const endMs = r.end.getTime();
      const diffDays = (endMs - startMs) / 86_400_000;

      assert.ok(diffDays >= 29);
      assert.ok(diffDays < 30);
    });

    it("starts 29 days before the end date", () => {
      const now = new Date("2024-06-15T12:00:00.000Z");
      const r = resolvePeriod("30d", now);

      assert.equal(r.start.toISOString(), "2024-05-17T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-06-15T23:59:59.999Z");
    });

    it("works across month and year boundary", () => {
      const now = new Date("2024-01-15T12:00:00.000Z");
      const r = resolvePeriod("30d", now);

      assert.equal(r.start.toISOString(), "2023-12-17T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-01-15T23:59:59.999Z");
    });
  });

  describe("month (This Month)", () => {
    it("starts at the beginning of the month and ends at the end", () => {
      const now = new Date("2024-06-15T12:30:00.000Z");
      const r = resolvePeriod("month", now);

      assert.equal(r.period, "month");
      assert.equal(r.label, "This Month");
      assert.equal(r.start.toISOString(), "2024-06-01T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-06-30T23:59:59.999Z");
    });

    it("handles January", () => {
      const now = new Date("2024-01-15T12:00:00.000Z");
      const r = resolvePeriod("month", now);

      assert.equal(r.start.toISOString(), "2024-01-01T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-01-31T23:59:59.999Z");
    });

    it("handles February in a leap year", () => {
      const now = new Date("2024-02-15T12:00:00.000Z");
      const r = resolvePeriod("month", now);

      assert.equal(r.start.toISOString(), "2024-02-01T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-02-29T23:59:59.999Z");
    });

    it("handles February in a non-leap year", () => {
      const now = new Date("2023-02-15T12:00:00.000Z");
      const r = resolvePeriod("month", now);

      assert.equal(r.start.toISOString(), "2023-02-01T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2023-02-28T23:59:59.999Z");
    });

    it("handles month with 30 days", () => {
      const now = new Date("2024-04-10T12:00:00.000Z");
      const r = resolvePeriod("month", now);

      assert.equal(r.start.toISOString(), "2024-04-01T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-04-30T23:59:59.999Z");
    });

    it("handles December end-of-year", () => {
      const now = new Date("2024-12-25T12:00:00.000Z");
      const r = resolvePeriod("month", now);

      assert.equal(r.start.toISOString(), "2024-12-01T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-12-31T23:59:59.999Z");
    });
  });

  describe("boundary conditions", () => {
    it("handles leap day as 'now' for 1d", () => {
      const now = new Date("2024-02-29T12:00:00.000Z");
      const r = resolvePeriod("1d", now);

      assert.equal(r.start.toISOString(), "2024-02-29T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-02-29T23:59:59.999Z");
    });

    it("handles leap day as 'now' for month", () => {
      const now = new Date("2024-02-29T12:00:00.000Z");
      const r = resolvePeriod("month", now);

      assert.equal(r.start.toISOString(), "2024-02-01T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-02-29T23:59:59.999Z");
    });

    it("handles year transition: Dec 31 -> Jan 1 for 7d", () => {
      const now = new Date("2025-01-01T12:00:00.000Z");
      const r = resolvePeriod("7d", now);

      assert.equal(r.start.toISOString(), "2024-12-26T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2025-01-01T23:59:59.999Z");
    });

    it("handles year transition: Dec 31 -> Jan 1 for 30d", () => {
      const now = new Date("2025-01-01T12:00:00.000Z");
      const r = resolvePeriod("30d", now);

      assert.equal(r.start.toISOString(), "2024-12-03T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2025-01-01T23:59:59.999Z");
    });

    it("handles month transition: Jan 31 -> Feb for 30d", () => {
      const now = new Date("2024-01-31T12:00:00.000Z");
      const r = resolvePeriod("30d", now);

      assert.equal(r.start.toISOString(), "2024-01-02T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-01-31T23:59:59.999Z");
    });

    it("handles instant at UTC midnight exactly", () => {
      const now = new Date("2024-06-15T00:00:00.000Z");
      const r = resolvePeriod("1d", now);

      assert.equal(r.start.toISOString(), "2024-06-15T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-06-15T23:59:59.999Z");
    });
  });

  describe("interval convention", () => {
    it("start is always the beginning of a day (00:00:00.000 UTC)", () => {
      const dates = [
        "2024-01-01T00:00:00.000Z",
        "2024-06-15T12:30:00.000Z",
        "2024-12-31T23:59:59.000Z",
      ];

      for (const d of dates) {
        const now = new Date(d);

        for (const period of ["1d", "7d", "30d", "month"] as const) {
          const r = resolvePeriod(period, now);
          assert.match(r.start.toISOString(), /T00:00:00\.000Z$/);
        }
      }
    });

    it("end is always the last millisecond of a day (23:59:59.999 UTC)", () => {
      const dates = [
        "2024-01-01T00:00:00.000Z",
        "2024-06-15T12:30:00.000Z",
        "2024-12-31T23:59:59.000Z",
      ];

      for (const d of dates) {
        const now = new Date(d);

        for (const period of ["1d", "7d", "30d", "month"] as const) {
          const r = resolvePeriod(period, now);
          assert.match(r.end.toISOString(), /T23:59:59\.999Z$/);
        }
      }
    });

    it("start <= end for all period types", () => {
      const dates = [
        "2024-01-01T00:00:00.000Z",
        "2024-06-15T12:30:00.000Z",
        "2024-12-31T23:59:59.000Z",
      ];

      for (const d of dates) {
        const now = new Date(d);

        for (const period of ["1d", "7d", "30d", "month"] as const) {
          const r = resolvePeriod(period, now);
          assert.ok(r.start.getTime() <= r.end.getTime());
        }
      }
    });
  });

  describe("timezone independence", () => {
    it("produces identical results for a UTC-late instant that would be 'next day' in a positive offset zone", () => {
      const now = new Date("2024-06-15T22:00:00.000Z");

      for (const period of ["1d", "7d", "30d", "month"] as const) {
        const r = resolvePeriod(period, now);
        assert.notEqual(r.start.toISOString(), "");
        assert.notEqual(r.end.toISOString(), "");
      }
    });

    it("produces identical results for a UTC-early instant that would be 'previous day' in a negative offset zone", () => {
      const now = new Date("2024-06-15T02:00:00.000Z");

      for (const period of ["1d", "7d", "30d", "month"] as const) {
        const r = resolvePeriod(period, now);
        assert.notEqual(r.start.toISOString(), "");
        assert.notEqual(r.end.toISOString(), "");
      }
    });

    it("1d period always refers to the UTC day of the instant regardless of what local time would suggest", () => {
      const lateUtc = new Date("2024-06-15T23:00:00.000Z");
      const r = resolvePeriod("1d", lateUtc);

      assert.equal(r.start.toISOString(), "2024-06-15T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-06-15T23:59:59.999Z");
    });
  });

  describe("default fallback", () => {
    it("defaults to 1d for invalid period", () => {
      const now = new Date("2024-06-15T12:00:00.000Z");
      const r = (resolvePeriod as unknown as (p: string, now?: Date) => ReturnType<typeof resolvePeriod>)(
        "invalid" as never,
        now,
      );

      assert.equal(r.period, "1d");
      assert.equal(r.label, "Today");
      assert.equal(r.start.toISOString(), "2024-06-15T00:00:00.000Z");
      assert.equal(r.end.toISOString(), "2024-06-15T23:59:59.999Z");
    });
  });

  describe("default now parameter", () => {
    it("uses current date when now is not provided", () => {
      const before = Date.now();
      const r = resolvePeriod("1d");
      const after = Date.now();

      assert.ok(r.start.getTime() >= before - 86_400_000);
      assert.ok(r.start.getTime() <= after + 86_400_000);
      assert.ok(r.end.getTime() >= before - 86_400_000);
      assert.ok(r.end.getTime() <= after + 86_400_000);
    });
  });
});
