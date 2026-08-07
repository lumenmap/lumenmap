#!/usr/bin/env node

import assert from "node:assert";

// Inline TypeScript compile mock or ESM test logic for buildTimeseries logic verification
function buildTimeseriesTest(period, start, end, rawRows, now) {
  const granularity = period === "1d" ? "hour" : "day";
  const buckets = [];

  const lookup = new Map();
  for (const row of rawRows) {
    if (!row.bucket_time) continue;
    const dt = new Date(row.bucket_time);
    if (isNaN(dt.getTime())) continue;
    const key =
      granularity === "hour"
        ? dt.toISOString().substring(0, 13)
        : dt.toISOString().substring(0, 10);

    const existing = lookup.get(key) ?? { tx_count: 0, op_count: 0 };
    lookup.set(key, {
      tx_count: existing.tx_count + row.tx_count,
      op_count: existing.op_count + row.op_count,
    });
  }

  const currentHourKey = now.toISOString().substring(0, 13);
  const currentDayKey = now.toISOString().substring(0, 10);

  if (granularity === "hour") {
    let curr = new Date(start);
    curr.setUTCMinutes(0, 0, 0);
    const limit = new Date(end);
    while (curr <= limit) {
      const iso = curr.toISOString();
      const hourKey = iso.substring(0, 13);
      const data = lookup.get(hourKey) ?? { tx_count: 0, op_count: 0 };

      const isCurrentHour = hourKey === currentHourKey;
      const isPastNow = curr > now;

      if (!isPastNow || buckets.length === 0 || curr <= new Date(now.getTime() + 3600000)) {
        const utcHour = String(curr.getUTCHours()).padStart(2, "0");
        buckets.push({
          timestamp: iso,
          label: `${utcHour}:00 UTC`,
          transactions: data.tx_count,
          operations: data.op_count,
          isPartial: isCurrentHour || (curr <= now && curr.getTime() + 3600000 > now.getTime()),
        });
      }

      curr = new Date(curr.getTime() + 3600000);
    }
  } else {
    let curr = new Date(start);
    curr.setUTCHours(0, 0, 0, 0);
    const limit = new Date(end);
    while (curr <= limit) {
      const iso = curr.toISOString();
      const dayKey = iso.substring(0, 10);
      const data = lookup.get(dayKey) ?? { tx_count: 0, op_count: 0 };

      const isCurrentDay = dayKey === currentDayKey;
      const isPastNow = curr > new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (!isPastNow || buckets.length === 0 || curr <= now) {
        const monthStr = curr.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
        const dayNum = curr.getUTCDate();
        buckets.push({
          timestamp: iso,
          label: `${monthStr} ${dayNum}`,
          transactions: data.tx_count,
          operations: data.op_count,
          isPartial: isCurrentDay || (curr <= now && curr.getTime() + 86400000 > now.getTime()),
        });
      }

      curr = new Date(curr.getTime() + 86400000);
    }
  }

  const totalTx = buckets.reduce((acc, b) => acc + b.transactions, 0);
  const totalOps = buckets.reduce((acc, b) => acc + b.operations, 0);

  return {
    granularity,
    buckets,
    totals: {
      transactions: totalTx,
      operations: totalOps,
    },
  };
}

console.log("Running timeseries test fixture verification...");

// Fixture 1: Multi-day period (7d) with partial current final bucket
const now = new Date("2026-07-29T14:30:00Z");
const start7d = new Date("2026-07-23T00:00:00Z");
const end7d = new Date("2026-07-29T23:59:59Z");

const multiDayRawRows = [
  { bucket_time: "2026-07-23T00:00:00Z", tx_count: 100, op_count: 350 },
  { bucket_time: "2026-07-24T00:00:00Z", tx_count: 150, op_count: 420 },
  { bucket_time: "2026-07-25T00:00:00Z", tx_count: 200, op_count: 600 },
  { bucket_time: "2026-07-26T00:00:00Z", tx_count: 180, op_count: 510 },
  { bucket_time: "2026-07-27T00:00:00Z", tx_count: 220, op_count: 700 },
  { bucket_time: "2026-07-28T00:00:00Z", tx_count: 300, op_count: 950 },
  { bucket_time: "2026-07-29T00:00:00Z", tx_count: 120, op_count: 400 }, // Partial day aggregate so far
];

const result7d = buildTimeseriesTest("7d", start7d, end7d, multiDayRawRows, now);

// Assertion 1: Buckets alignment
assert.strictEqual(result7d.buckets.length, 7, "7d period should have 7 daily buckets");
assert.strictEqual(result7d.granularity, "day");

// Assertion 2: Partial bucket marking on current day (July 29)
const lastBucket = result7d.buckets[result7d.buckets.length - 1];
assert.strictEqual(lastBucket.isPartial, true, "Final bucket (today) must be marked as partial");
assert.strictEqual(result7d.buckets[0].isPartial, false, "Historical completed days must not be marked partial");

// Assertion 3: Reconciliation with aggregates
const expectedTotalTx = 100 + 150 + 200 + 180 + 220 + 300 + 120;
const expectedTotalOps = 350 + 420 + 600 + 510 + 700 + 950 + 400;

assert.strictEqual(result7d.totals.transactions, expectedTotalTx, "Series total transactions must reconcile with source aggregate");
assert.strictEqual(result7d.totals.operations, expectedTotalOps, "Series total operations must reconcile with source aggregate");

// Fixture 2: 1d period with hourly buckets and gap filling
const start1d = new Date("2026-07-29T00:00:00Z");
const end1d = new Date("2026-07-29T23:59:59Z");
const hourlyRawRows = [
  { bucket_time: "2026-07-29T00:00:00Z", tx_count: 10, op_count: 40 },
  { bucket_time: "2026-07-29T02:00:00Z", tx_count: 25, op_count: 80 }, // Note hour 01 is missing in raw
  { bucket_time: "2026-07-29T14:00:00Z", tx_count: 50, op_count: 150 }, // Ongoing current hour
];

const result1d = buildTimeseriesTest("1d", start1d, end1d, hourlyRawRows, now);
assert.strictEqual(result1d.granularity, "hour");

// Gap filling check: hour 01 should exist with 0 tx and 0 ops
const hour1Bucket = result1d.buckets.find((b) => b.label === "01:00 UTC");
assert.ok(hour1Bucket, "Hour 01:00 UTC bucket must exist (gap filled)");
assert.strictEqual(hour1Bucket.transactions, 0);
assert.strictEqual(hour1Bucket.operations, 0);

// Current hour 14:00 UTC should be marked isPartial
const hour14Bucket = result1d.buckets.find((b) => b.label === "14:00 UTC");
assert.ok(hour14Bucket, "Hour 14:00 UTC bucket must exist");
assert.strictEqual(hour14Bucket.isPartial, true, "14:00 UTC bucket must be marked partial");

console.log("All fixture assertions PASSED successfully!");
