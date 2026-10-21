import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEmbedFramePolicy, embedKpiSnapshot, parseEmbedQuery } from "@/lib/embed";

describe("embed widgets", () => {
  it("allows any parent when the allowlist is unset", () => {
    const policy = buildEmbedFramePolicy(undefined);
    assert.equal(policy.blocksUnknownParents, false);
    assert.equal(policy.contentSecurityPolicy, "frame-ancestors *");
  });

  it("blocks unknown parents when an allowlist is configured", () => {
    const policy = buildEmbedFramePolicy("https://example.com, https://docs.example.com");
    assert.equal(policy.blocksUnknownParents, true);
    assert.equal(
      policy.contentSecurityPolicy,
      "frame-ancestors 'self' https://example.com https://docs.example.com",
    );
  });

  it("falls back to 7d ops for unknown query params", () => {
    assert.deepEqual(parseEmbedQuery({ period: "year", metric: "price" }), {
      period: "7d",
      metric: "ops",
    });
  });

  it("keeps a stable KPI strip snapshot", () => {
    assert.equal(
      embedKpiSnapshot("7d", "ops"),
      ["Operations: 84,200", "Active wallets: 4,510", "Soroban share: 48%"].join("\n"),
    );
  });
});
