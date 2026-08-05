import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseCacheTtl,
  setCache,
  getCached,
  clearCache,
  DEFAULT_CACHE_TTL_SECONDS,
  MIN_CACHE_TTL_SECONDS,
  MAX_CACHE_TTL_SECONDS,
} from "./cache";

describe("parseCacheTtl", () => {
  test("missing or empty configuration uses default TTL (900s)", () => {
    assert.equal(parseCacheTtl(undefined), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl(null), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl(""), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl("   "), DEFAULT_CACHE_TTL_SECONDS);
  });

  test("valid numeric and string values within [1, 86400] range are accepted", () => {
    assert.equal(parseCacheTtl(MIN_CACHE_TTL_SECONDS), 1);
    assert.equal(parseCacheTtl(60), 60);
    assert.equal(parseCacheTtl("300"), 300);
    assert.equal(parseCacheTtl(900), 900);
    assert.equal(parseCacheTtl(3600), 3600);
    assert.equal(parseCacheTtl(MAX_CACHE_TTL_SECONDS), 86400);
    assert.equal(parseCacheTtl("86400"), 86400);
  });

  test("floats within valid range are floored to whole seconds", () => {
    assert.equal(parseCacheTtl(300.7), 300);
    assert.equal(parseCacheTtl("150.9"), 150);
  });

  test("non-numeric inputs fall back to default TTL", () => {
    assert.equal(parseCacheTtl("invalid"), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl("abc"), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl({}), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl([]), DEFAULT_CACHE_TTL_SECONDS);
  });

  test("non-finite inputs (NaN, Infinity, -Infinity) fall back to default TTL", () => {
    assert.equal(parseCacheTtl(NaN), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl(Infinity), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl(-Infinity), DEFAULT_CACHE_TTL_SECONDS);
  });

  test("zero falls back to default TTL", () => {
    assert.equal(parseCacheTtl(0), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl("0"), DEFAULT_CACHE_TTL_SECONDS);
  });

  test("negative values fall back to default TTL", () => {
    assert.equal(parseCacheTtl(-1), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl(-900), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl("-60"), DEFAULT_CACHE_TTL_SECONDS);
  });

  test("over-limit values (> 86400) fall back to default TTL", () => {
    assert.equal(parseCacheTtl(MAX_CACHE_TTL_SECONDS + 1), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl(100_000), DEFAULT_CACHE_TTL_SECONDS);
    assert.equal(parseCacheTtl("9999999"), DEFAULT_CACHE_TTL_SECONDS);
  });
});

describe("in-memory cache behavior", () => {
  beforeEach(() => {
    clearCache();
  });

  test("setCache and getCached store and retrieve data with valid TTL", () => {
    setCache("testKey", { foo: "bar" }, 60);
    const cached = getCached<{ foo: string }>("testKey");
    assert.deepEqual(cached, { foo: "bar" });
  });

  test("setCache with invalid TTL parameters safely falls back to default TTL", () => {
    setCache("invalidTtlKey", "value", -500);
    assert.equal(getCached<string>("invalidTtlKey"), "value");

    setCache("nanTtlKey", "value2", NaN);
    assert.equal(getCached<string>("nanTtlKey"), "value2");
  });

  test("setCache using process.env.CACHE_TTL_SECONDS handles valid and invalid env vars", () => {
    const originalEnv = process.env.CACHE_TTL_SECONDS;
    try {
      process.env.CACHE_TTL_SECONDS = "600";
      setCache("envValid", "data1");
      assert.equal(getCached<string>("envValid"), "data1");

      process.env.CACHE_TTL_SECONDS = "-999";
      setCache("envInvalid", "data2");
      assert.equal(getCached<string>("envInvalid"), "data2");

      delete process.env.CACHE_TTL_SECONDS;
      setCache("envMissing", "data3");
      assert.equal(getCached<string>("envMissing"), "data3");
    } finally {
      process.env.CACHE_TTL_SECONDS = originalEnv;
    }
  });

  test("getCached returns null for non-existent keys", () => {
    assert.equal(getCached("nonexistent"), null);
  });
});
