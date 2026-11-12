import { buildEmbedFramePolicy } from "./embed";

export type SecurityHeadersOptions = {
  pathname?: string;
  embedAllowlist?: string;
  isProd?: boolean;
};

export function buildDashboardContentSecurityPolicy(options?: {
  isProd?: boolean;
  frameAncestorsDirective?: string;
}): string {
  const isProd = options?.isProd ?? process.env.NODE_ENV === "production";
  const frameAncestors =
    options?.frameAncestorsDirective ?? "frame-ancestors 'none'";

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isProd ? [] : ["'unsafe-eval'"]),
  ].join(" ");

  const connectSrc = ["'self'", ...(isProd ? [] : ["ws:", "wss:"])].join(" ");

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    frameAncestors,
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    `connect-src ${connectSrc}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];

  return directives.join("; ");
}

export function buildSecurityHeaders(
  options: SecurityHeadersOptions = {},
): Record<string, string> {
  const pathname = options.pathname ?? "/";
  const isEmbed = pathname === "/embed" || pathname.startsWith("/embed/");
  const isProd = options.isProd ?? process.env.NODE_ENV === "production";

  const frameAncestorsDirective = isEmbed
    ? buildEmbedFramePolicy(options.embedAllowlist).contentSecurityPolicy
    : "frame-ancestors 'none'";

  const headers: Record<string, string> = {
    "Content-Security-Policy": buildDashboardContentSecurityPolicy({
      isProd,
      frameAncestorsDirective,
    }),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  };

  if (!isEmbed) {
    headers["X-Frame-Options"] = "DENY";
  }

  if (isProd) {
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}
