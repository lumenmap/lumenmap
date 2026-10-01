#!/usr/bin/env node

import assert from "node:assert/strict";
import { mapActiveDestinationCountRow, mapAccountRows } from "../lib/hubble/queries.ts";

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
    console.error(`        ${error instanceof Error ? error.message : String(error)}`);
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

console.log("\nmapAccountRows (destination/receiver mapping)");

test("maps destination account rows correctly", () => {
  const result = mapAccountRows([
    { account_id: "G123", type_string: "payment", op_count: 5, xlm_volume: 100.5 },
    { account_id: "G456", type_string: "create_account", op_count: "2", xlm_volume: "0" }
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].account_id, "G123");
  assert.equal(result[0].type_string, "payment");
  assert.equal(result[0].op_count, 5);
  assert.equal(result[0].xlm_volume, 100.5);
  
  assert.equal(result[1].account_id, "G456");
  assert.equal(result[1].type_string, "create_account");
  assert.equal(result[1].op_count, 2);
  assert.equal(result[1].xlm_volume, 0);
});

test("handles empty rows for receiver ranking", () => {
  const result = mapAccountRows([]);
  assert.equal(result.length, 0);
});

if (failed > 0) {
  console.log(`\n${failed} test(s) failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\n${passed} test(s) passed`);
