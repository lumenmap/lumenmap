import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { buildContentSecurityPolicy } from "@/lib/security-headers";

function run(path: string) {
  return middleware(new NextRequest(`http://localhost:3000${path}`));
}

describe("security headers", () => {
  it("sets the full header set on HTML routes", () => {
    const res = run("/");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.match(res.headers.get("Permissions-Policy") ?? "", /camera=\(\)/);
    assert.equal(res.headers.get("X-Frame-Options"), "DENY");
  });

  it("sets the same headers on API routes", () => {
    const res = run("/api/health");
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.match(res.headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  });

  it("keeps embed routes frameable via EMBED_FRAME_ANCESTORS", () => {
    const previous = process.env.EMBED_FRAME_ANCESTORS;
    try {
      delete process.env.EMBED_FRAME_ANCESTORS;
      const open = run("/embed/widget");
      assert.match(open.headers.get("Content-Security-Policy") ?? "", /frame-ancestors \*$/);
      assert.equal(open.headers.get("X-Frame-Options"), null);

      process.env.EMBED_FRAME_ANCESTORS = "https://example.com";
      const limited = run("/embed/widget");
      assert.match(
        limited.headers.get("Content-Security-Policy") ?? "",
        /frame-ancestors 'self' https:\/\/example\.com$/,
      );
      assert.equal(limited.headers.get("X-Content-Type-Options"), "nosniff");
    } finally {
      if (previous === undefined) delete process.env.EMBED_FRAME_ANCESTORS;
      else process.env.EMBED_FRAME_ANCESTORS = previous;
    }
  });

  it("allows unsafe-eval only in development", () => {
    assert.doesNotMatch(buildContentSecurityPolicy(), /unsafe-eval/);
    assert.match(buildContentSecurityPolicy({ isDev: true }), /unsafe-eval/);
  });
});
