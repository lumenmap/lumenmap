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

## HTTP Security Headers

`middleware.ts` applies the headers below to every HTML page and API response (static build assets under `/_next/static` and `/_next/image` are excluded). The values live in `lib/security-headers.ts` and are asserted in `lib/security-headers.test.ts`.

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' 'unsafe-inline'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self' data:`; `connect-src 'self'`; `worker-src 'self'`; `manifest-src 'self'`; `frame-src 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'` | Same-origin only. Expert and other external links are navigations, not script/connect sources. Third-party data (Stellar Expert directory, DefiLlama) is fetched server-side. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Outbound links only leak the origin, never dashboard URL state. |
| `X-Content-Type-Options` | `nosniff` | Disables MIME sniffing. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | The dashboard uses none of these features. |
| `X-Frame-Options` | `DENY` (non-embed routes only) | Legacy equivalent of `frame-ancestors 'none'`. |

Notes:

- `'unsafe-inline'` for scripts and styles is required by Next.js bootstrap scripts and inline chart styles. Nonces would force every page to render dynamically, so they are not used.
- `'unsafe-eval'` is added to `script-src` only when `NODE_ENV=development` (React Refresh).
- `blob:` and `data:` in `img-src` support client-side chart PNG export.
- **Embed routes (`/embed/*`)** use the same policy, but `frame-ancestors` comes from `buildEmbedFramePolicy` in `lib/embed.ts` and `X-Frame-Options` is removed. With `EMBED_FRAME_ANCESTORS` unset, embeds allow any parent (`frame-ancestors *`); when set (comma-separated origins), only `'self'` and those origins may frame them.
- If a new third-party origin is needed, add it to the specific directive in `lib/security-headers.ts`, update this table, and keep the header test green.
