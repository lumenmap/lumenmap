import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTENT_SECURITY_POLICY,
  CSP_DIRECTIVES,
  SECURITY_HEADERS,
} from "./security-headers";

describe("Security Headers Configuration", () => {
  it("defines all mandatory security headers", () => {
    const headerKeys = SECURITY_HEADERS.map((h) => h.key);
    assert.ok(headerKeys.includes("Content-Security-Policy"));
    assert.ok(headerKeys.includes("Referrer-Policy"));
    assert.ok(headerKeys.includes("X-Content-Type-Options"));
    assert.ok(headerKeys.includes("X-Frame-Options"));
    assert.ok(headerKeys.includes("Permissions-Policy"));
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    const h = SECURITY_HEADERS.find((x) => x.key === "X-Content-Type-Options");
    assert.equal(h?.value, "nosniff");
  });

  it("sets X-Frame-Options to DENY to prevent clickjacking", () => {
    const h = SECURITY_HEADERS.find((x) => x.key === "X-Frame-Options");
    assert.equal(h?.value, "DENY");
  });

  it("sets Referrer-Policy to strict-origin-when-cross-origin", () => {
    const h = SECURITY_HEADERS.find((x) => x.key === "Referrer-Policy");
    assert.equal(h?.value, "strict-origin-when-cross-origin");
  });

  it("restricts dangerous browser capabilities in Permissions-Policy", () => {
    const h = SECURITY_HEADERS.find((x) => x.key === "Permissions-Policy");
    assert.ok(h?.value.includes("camera=()"));
    assert.ok(h?.value.includes("microphone=()"));
    assert.ok(h?.value.includes("geolocation=()"));
    assert.ok(h?.value.includes("browsing-topics=()"));
  });

  describe("Content Security Policy (CSP)", () => {
    it("sets default-src to self", () => {
      assert.ok(CSP_DIRECTIVES.includes("default-src 'self'"));
    });

    it("restricts object-src to none to prevent plugin execution", () => {
      assert.ok(CSP_DIRECTIVES.includes("object-src 'none'"));
    });

    it("restricts base-uri and form-action to self", () => {
      assert.ok(CSP_DIRECTIVES.includes("base-uri 'self'"));
      assert.ok(CSP_DIRECTIVES.includes("form-action 'self'"));
    });

    it("restricts frame-ancestors to none", () => {
      assert.ok(CSP_DIRECTIVES.includes("frame-ancestors 'none'"));
    });

    it("allows required image and font sources", () => {
      assert.ok(CSP_DIRECTIVES.some((d) => d.startsWith("img-src 'self'")));
      assert.ok(CSP_DIRECTIVES.some((d) => d.startsWith("font-src 'self'")));
    });

    it("restricts connect-src to self and approved API endpoints", () => {
      const connectSrc = CSP_DIRECTIVES.find((d) => d.startsWith("connect-src"));
      assert.ok(connectSrc);
      assert.ok(connectSrc.includes("'self'"));
      assert.ok(connectSrc.includes("https://api.stellar.expert"));
      assert.ok(connectSrc.includes("https://api.llama.fi"));
    });

    it("formats CONTENT_SECURITY_POLICY as semicolon-separated string", () => {
      assert.equal(CONTENT_SECURITY_POLICY, CSP_DIRECTIVES.join("; "));
    });
  });
});
