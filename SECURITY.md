# Security Policy

## Secret Scanning and Push Protection

This repository relies on GitHub Secret Scanning and Push Protection to prevent accidental leaks of credentials, API keys, and other sensitive information.

### Maintainer Unblock Process for False Positives

If Push Protection blocks a commit due to a suspected secret that is actually a false positive (e.g., dummy test data or a non-sensitive string resembling a token), maintainers and contributors can unblock the push by following these steps:

1. **Review the Block:** When a push is blocked, the Git output will display a message with a link to GitHub.
2. **Navigate to the Link:** Open the provided link in your web browser to view the detected secret.
3. **Select Bypass Reason:** If you have confirmed it is a false positive, select the appropriate reason from the dropdown (e.g., "False positive", "Used in tests", or "Will fix later").
4. **Confirm the Bypass:** Submit the form to bypass the protection for this specific secret.
5. **Re-push:** Run your `git push` command again. It will now succeed.

**Important:** 
- Bypasses are audited. Maintainers periodically review bypass logs.
- **Never bypass push protection for a real secret.** If a real secret is detected, remove it from your commit history before pushing. If it was already exposed, it must be rotated immediately.

## HTTP Security Headers and Content Security Policy (#459)

LumenMap applies hardened HTTP security headers across both dashboard HTML pages and `/api/*` responses via [`next.config.ts`](next.config.ts), [`middleware.ts`](middleware.ts), and [`lib/http/security-headers.ts`](lib/http/security-headers.ts).

| Header | Value / Policy | Rationale |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` | Restricts scripts, XHR/SSE connections (`connect-src 'self'`), and workers to same-origin. Stellar Expert outbound links are top-level `<a target="_blank" rel="noopener noreferrer">` navigations, so no third-party script or connect allowlist is required. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends only the origin on cross-origin navigations (such as Stellar Expert explorer links) and strips query parameters / deep-link state. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniffing on HTML and JSON API responses. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()` | Disables sensitive browser APIs unused by the research dashboard. |
| `X-DNS-Prefetch-Control` | `off` | Prevents unsolicited DNS prefetch leaks for unvisited external links. |
| `X-Frame-Options` | `DENY` (omitted on `/embed/*`) | Blocks framing of standard dashboard routes while allowing `/embed/*` routes to be governed by `EMBED_FRAME_ANCESTORS` in `frame-ancestors`. |
