#!/usr/bin/env node

import assert from "node:assert/strict";

function mapActiveDestinationCountRow(rows) {
  return {
    active_destination_count:
      rows.length > 0 ? Number(rows[0].active_destination_count) : 0,
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL  ${name}`);
    if (error instanceof assert.AssertionError) {
      console.error(`        ${error.message}`);
    } else {
      console.error(`        ${error.message}`);
    }
  }
}

console.log("mapActiveDestinationCountRow");

test("returns the count from the first row", () => {
  const result = mapActiveDestinationCountRow([
    { active_destination_count: 42 },
  ]);
  assert.equal(result.active_destination_count, 42);
});

test("returns 0 for empty rows", () => {
  const result = mapActiveDestinationCountRow([]);
  assert.equal(result.active_destination_count, 0);
});

test("handles zero count", () => {
  const result = mapActiveDestinationCountRow([
    { active_destination_count: 0 },
  ]);
  assert.equal(result.active_destination_count, 0);
});

test("handles large count", () => {
  const result = mapActiveDestinationCountRow([
    { active_destination_count: 999999 },
  ]);
  assert.equal(result.active_destination_count, 999999);
});

test("coerces string count to number", () => {
  const result = mapActiveDestinationCountRow([
    { active_destination_count: "123" },
  ]);
  assert.equal(result.active_destination_count, 123);
});

test("ignores subsequent rows", () => {
  const result = mapActiveDestinationCountRow([
    { active_destination_count: 7 },
    { active_destination_count: 99 },
  ]);
  assert.equal(result.active_destination_count, 7);
});

if (failed > 0) {
  console.log(`\n${failed} test(s) failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\n${passed} test(s) passed`);
