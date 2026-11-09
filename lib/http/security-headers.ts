import { buildEmbedFramePolicy } from "@/lib/embed";

export type SecurityHeaderEntry = {
  key: string;
  value: string;
};

export interface SecurityHeadersOptions {
  pathname?: string;
  embedFrameAncestors?: string;
  isDev?: boolean;
}

export const PERMISSIONS_POLICY_VALUE =
  "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()";

export const REFERRER_POLICY_VALUE = "strict-origin-when-cross-origin";

export function isEmbedPathname(pathname = "/"): boolean {
  return pathname === "/embed" || pathname.startsWith("/embed/");
}

export function buildDashboardCsp(
  options: SecurityHeadersOptions = {},
): string {
  const isDev =
    options.isDev ?? process.env.NODE_ENV !== "production";
  const isEmbed = isEmbedPathname(options.pathname);
  const frameAncestorsDirective = isEmbed
    ? buildEmbedFramePolicy(options.embedFrameAncestors).contentSecurityPolicy
    : "frame-ancestors 'none'";

  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    frameAncestorsDirective,
  ].join("; ");
}

export function buildSecurityHeaders(
  options: SecurityHeadersOptions = {},
): SecurityHeaderEntry[] {
  const isEmbed = isEmbedPathname(options.pathname);
  const csp = buildDashboardCsp(options);

  const headers: SecurityHeaderEntry[] = [
    {
      key: "Content-Security-Policy",
      value: csp,
    },
    {
      key: "Referrer-Policy",
      value: REFERRER_POLICY_VALUE,
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Permissions-Policy",
      value: PERMISSIONS_POLICY_VALUE,
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "off",
    },
  ];

  if (!isEmbed) {
    headers.push({
      key: "X-Frame-Options",
      value: "DENY",
    });
  }

  return headers;
}
