/**
 * Security headers applied to every HTML and API response by `middleware.ts`.
 * Documented in SECURITY.md ("HTTP Security Headers").
 */

export const DEFAULT_FRAME_ANCESTORS = "frame-ancestors 'none'";

type SecurityHeaderOptions = {
  /** Full `frame-ancestors` directive. Embed routes pass the EMBED_FRAME_ANCESTORS policy. */
  frameAncestors?: string;
  /** Next.js dev (React Refresh) needs `unsafe-eval`; production does not. */
  isDev?: boolean;
};

/**
 * Build the Content-Security-Policy value.
 * Only same-origin sources are allowed: Expert and other external links are
 * navigations, and third-party data (Stellar Expert, DefiLlama) is fetched server-side.
 * `unsafe-inline` is required for Next.js bootstrap scripts and inline chart styles
 * because nonces would force every page to render dynamically.
 */
export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}): string {
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(options.isDev ? ["'unsafe-eval'"] : [])];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    options.frameAncestors ?? DEFAULT_FRAME_ANCESTORS,
  ].join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): Record<string, string> {
  return {
    "Content-Security-Policy": buildContentSecurityPolicy(options),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  };
}
