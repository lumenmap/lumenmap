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

## HTTP Security Headers and Content Security Policy

LumenMap applies hardened HTTP response headers across dashboard HTML pages and `/api/*` routes via `lib/security-headers.ts`, `middleware.ts`, and `next.config.ts`:

| Header | Dashboard & API Routes | `/embed/*` Widget Routes | Purpose |
| --- | --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self' blob:` | Same policy, except `frame-ancestors` follows `EMBED_FRAME_ANCESTORS` (`frame-ancestors *` when unset, or `frame-ancestors 'self' <origins>`) | Restricts executable scripts, styles, fonts, XHR/fetch connections, manifests, and workers strictly to required same-origin and local `data:`/`blob:` chart-export sources |
| `X-Frame-Options` | `DENY` | Omitted | Blocks clickjacking on primary dashboard routes while allowing authorized parent pages to iframe `/embed/*` widgets |
| `X-Content-Type-Options` | `nosniff` | `nosniff` | Prevents MIME-type sniffing on HTML, JSON API, and static responses |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `strict-origin-when-cross-origin` | Avoids leaking full query/account URLs to cross-origin destinations |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Same | Disables unused browser device APIs and Topics API |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) | Same (production only) | Enforces HTTPS transport in production deployments |

### Design Notes

- **Stellar Expert outbound links:** Explorer links (`https://stellar.expert/...`) are top-level `<a href>` navigations rather than subresource fetches or third-party scripts, so they require no `script-src` or `connect-src` CSP exceptions.
- **Development HMR:** Outside `NODE_ENV=production`, `script-src` appends `'unsafe-eval'` and `connect-src` appends `ws: wss:` so Next.js fast refresh works locally without loosening production headers.

