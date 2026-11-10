import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_CUSTOM_RANGE_DAYS,
  parseCustomUtcDateRange,
} from "@/lib/periods";
import {
  parseDashboardUrlSearch,
  writeDashboardUrlSearch,
} from "@/lib/dashboard-url-state";
import { handleActivityRequest } from "@/app/api/activity/_handler";

describe("Custom UTC date-range picker and validation (#444)", () => {
  it("parses valid YYYY-MM-DD UTC bounds and computes inclusive day span", () => {
    const res = parseCustomUtcDateRange("2026-01-01", "2026-01-10");
    assert.equal(res.ok, true);
    if (!res.ok || !res.range) return;
    assert.equal(res.range.start.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(res.range.end.toISOString(), "2026-01-10T23:59:59.999Z");
    assert.equal(res.range.days, 10);
  });

  it("rejects inverted ranges, spans over 90 days, partial inputs, and invalid dates", () => {
    const inverted = parseCustomUtcDateRange("2026-02-10", "2026-02-01");
    assert.equal(inverted.ok, false);

    const tooLong = parseCustomUtcDateRange("2026-01-01", "2026-05-01");
    assert.equal(tooLong.ok, false);
    if (!tooLong.ok) {
      assert.match(tooLong.message, new RegExp(String(MAX_CUSTOM_RANGE_DAYS)));
    }

    const partial = parseCustomUtcDateRange("2026-01-01", null);
    assert.equal(partial.ok, false);

    const badCalendar = parseCustomUtcDateRange("2026-02-30", "2026-03-02");
    assert.equal(badCalendar.ok, false);
  });

  it("round-trips customStart and customEnd in dashboard URL state", () => {
    const query = writeDashboardUrlSearch({
      period: "7d",
      metric: "ops",
      view: "events",
      path: [],
      customStart: "2026-01-05",
      customEnd: "2026-01-20",
    });
    assert.match(query, /start=2026-01-05/);
    assert.match(query, /end=2026-01-20/);

    const parsed = parseDashboardUrlSearch(query);
    assert.equal(parsed.customStart, "2026-01-05");
    assert.equal(parsed.customEnd, "2026-01-20");
  });

  it("returns HTTP 400 from /api/activity for inverted or >90d custom ranges and deterministic 200 in fixture mode", async () => {
    const prevSource = process.env.LUMENMAP_DATA_SOURCE;
    process.env.LUMENMAP_DATA_SOURCE = "fixture";
    try {
      const badRes = await handleActivityRequest(
        new Request(
          "http://localhost/api/activity?period=7d&start=2026-02-10&end=2026-02-01",
        ),
      );
      assert.equal(badRes.status, 400);
      const badBody = (await badRes.json()) as { code: string };
      assert.equal(badBody.code, "INVALID_DATE_RANGE");

      const okRes = await handleActivityRequest(
        new Request(
          "http://localhost/api/activity?period=7d&start=2026-01-05&end=2026-01-15",
        ),
      );
      assert.equal(okRes.status, 200);
      const okBody = (await okRes.json()) as { start: string; end: string };
      assert.equal(okBody.start, "2026-01-05T00:00:00.000Z");
      assert.equal(okBody.end, "2026-01-15T23:59:59.999Z");
    } finally {
      if (prevSource === undefined) {
        delete process.env.LUMENMAP_DATA_SOURCE;
      } else {
        process.env.LUMENMAP_DATA_SOURCE = prevSource;
      }
    }
  });
});
