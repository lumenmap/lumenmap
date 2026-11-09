import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import {
  buildDashboardCsp,
  buildSecurityHeaders,
  PERMISSIONS_POLICY_VALUE,
  REFERRER_POLICY_VALUE,
} from "./security-headers";

describe("CSP and security header hardening (#459)", () => {
  it("builds hardened CSP and security headers for standard dashboard and API routes", () => {
    const headers = buildSecurityHeaders({ pathname: "/", isDev: false });
    const map = new Map(headers.map((h) => [h.key, h.value]));

    assert.equal(map.get("Referrer-Policy"), REFERRER_POLICY_VALUE);
    assert.equal(map.get("X-Content-Type-Options"), "nosniff");
    assert.equal(map.get("Permissions-Policy"), PERMISSIONS_POLICY_VALUE);
    assert.equal(map.get("X-Frame-Options"), "DENY");

    const csp = map.get("Content-Security-Policy") ?? "";
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("connect-src 'self'"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(!csp.includes("'unsafe-eval'"));
  });

  it("preserves embed frame-ancestors policy on /embed/* routes without X-Frame-Options", () => {
    const headers = buildSecurityHeaders({
      pathname: "/embed/treemap",
      embedFrameAncestors: "https://stellar.org",
      isDev: false,
    });
    const map = new Map(headers.map((h) => [h.key, h.value]));

    assert.equal(map.has("X-Frame-Options"), false);
    const csp = map.get("Content-Security-Policy") ?? "";
    assert.ok(csp.includes("frame-ancestors 'self' https://stellar.org"));
    assert.ok(csp.includes("default-src 'self'"));
  });

  it("attaches security headers in middleware for HTML, API, and embed routes", () => {
    const htmlRes = middleware(new NextRequest("http://localhost:3000/"));
    assert.equal(
      htmlRes.headers.get("Referrer-Policy"),
      REFERRER_POLICY_VALUE,
    );
    assert.equal(htmlRes.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(
      htmlRes.headers.get("Permissions-Policy"),
      PERMISSIONS_POLICY_VALUE,
    );
    assert.equal(htmlRes.headers.get("X-Frame-Options"), "DENY");
    assert.ok(
      (htmlRes.headers.get("Content-Security-Policy") ?? "").includes(
        "frame-ancestors 'none'",
      ),
    );

    const apiRes = middleware(
      new NextRequest("http://localhost:3000/api/v1/activity?period=1d"),
    );
    assert.equal(apiRes.headers.get("X-Content-Type-Options"), "nosniff");
    assert.ok(
      (apiRes.headers.get("Content-Security-Policy") ?? "").includes(
        "default-src 'self'",
      ),
    );

    const embedRes = middleware(
      new NextRequest("http://localhost:3000/embed/kpi"),
    );
    assert.equal(embedRes.headers.get("X-Frame-Options"), null);
    assert.ok(
      (embedRes.headers.get("Content-Security-Policy") ?? "").includes(
        "frame-ancestors *",
      ),
    );
    assert.ok(
      buildDashboardCsp({ pathname: "/flow", isDev: true }).includes(
        "'unsafe-eval'",
      ),
    );
  });
});
