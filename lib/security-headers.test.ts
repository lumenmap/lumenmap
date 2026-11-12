import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  buildDashboardContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/lib/security-headers";
import { middleware } from "@/middleware";

describe("dashboard CSP and security headers", () => {
  it("hardens dashboard and API routes with strict self-only CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, and Permissions-Policy", () => {
    for (const pathname of ["/", "/api/v1/activity"]) {
      const headers = buildSecurityHeaders({
        pathname,
        isProd: true,
      });

      assert.equal(headers["X-Frame-Options"], "DENY");
      assert.equal(headers["X-Content-Type-Options"], "nosniff");
      assert.equal(
        headers["Referrer-Policy"],
        "strict-origin-when-cross-origin",
      );
      assert.ok(headers["Permissions-Policy"]?.includes("camera=()"));
      assert.equal(
        headers["Strict-Transport-Security"],
        "max-age=63072000; includeSubDomains; preload",
      );

      const csp = headers["Content-Security-Policy"] ?? "";
      assert.ok(csp.includes("default-src 'self'"));
      assert.ok(csp.includes("object-src 'none'"));
      assert.ok(csp.includes("base-uri 'self'"));
      assert.ok(csp.includes("frame-ancestors 'none'"));
      assert.ok(csp.includes("connect-src 'self'"));
      assert.ok(csp.includes("manifest-src 'self'"));
      assert.ok(csp.includes("worker-src 'self' blob:"));
      assert.ok(!csp.includes("'unsafe-eval'"));
      assert.ok(!csp.includes("fonts.googleapis.com"));
      assert.ok(!csp.includes("stellar.expert"));
    }
  });

  it("omits HSTS and allows unsafe-eval plus WebSocket HMR in development", () => {
    const headers = buildSecurityHeaders({
      pathname: "/",
      isProd: false,
    });

    assert.equal(headers["Strict-Transport-Security"], undefined);
    const csp = headers["Content-Security-Policy"] ?? "";
    assert.ok(csp.includes("'unsafe-eval'"));
    assert.ok(csp.includes("connect-src 'self' ws: wss:"));
  });

  it("preserves configurable frame-ancestors and omits X-Frame-Options on /embed routes", () => {
    const openEmbedHeaders = buildSecurityHeaders({
      pathname: "/embed/kpi",
      embedAllowlist: undefined,
      isProd: true,
    });

    assert.equal(openEmbedHeaders["X-Frame-Options"], undefined);
    assert.ok(
      openEmbedHeaders["Content-Security-Policy"]?.includes(
        "frame-ancestors *",
      ),
    );
    assert.equal(openEmbedHeaders["X-Content-Type-Options"], "nosniff");

    const restrictedEmbedHeaders = buildSecurityHeaders({
      pathname: "/embed/kpi",
      embedAllowlist: "https://stellar.org, https://docs.stellar.org",
      isProd: true,
    });

    assert.equal(restrictedEmbedHeaders["X-Frame-Options"], undefined);
    assert.ok(
      restrictedEmbedHeaders["Content-Security-Policy"]?.includes(
        "frame-ancestors 'self' https://stellar.org https://docs.stellar.org",
      ),
    );
  });

  it("attaches headers on HTML, API, and /embed requests through middleware", () => {
    const dashRes = middleware(new NextRequest("http://localhost:3000/"));
    assert.equal(dashRes.headers.get("X-Frame-Options"), "DENY");
    assert.equal(dashRes.headers.get("X-Content-Type-Options"), "nosniff");
    assert.ok(
      dashRes.headers
        .get("Content-Security-Policy")
        ?.includes("frame-ancestors 'none'"),
    );

    const apiRes = middleware(
      new NextRequest("http://localhost:3000/api/health"),
    );
    assert.equal(apiRes.headers.get("X-Frame-Options"), "DENY");
    assert.equal(
      apiRes.headers.get("Referrer-Policy"),
      "strict-origin-when-cross-origin",
    );

    const embedRes = middleware(
      new NextRequest("http://localhost:3000/embed/kpi"),
    );
    assert.equal(embedRes.headers.get("X-Frame-Options"), null);
    assert.ok(
      embedRes.headers
        .get("Content-Security-Policy")
        ?.includes("frame-ancestors"),
    );

    const standaloneCsp = buildDashboardContentSecurityPolicy({ isProd: true });
    assert.ok(standaloneCsp.includes("img-src 'self' data: blob:"));
  });
});
