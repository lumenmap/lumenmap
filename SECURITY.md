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

---

## Security Headers & Content Security Policy (CSP)

LumenMap enforces strict HTTP security headers across all dashboard and API routes to protect against Cross-Site Scripting (XSS), clickjacking, MIME-sniffing, and data exfiltration.

### Implemented Headers

| Header | Value | Purpose & Rationale |
| :--- | :--- | :--- |
| **`Content-Security-Policy`** | `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; connect-src 'self' https://api.stellar.expert https://api.llama.fi` | Enforces a strict default boundary. Restricts object embedding, prevents framing, and limits network fetches strictly to the local origin and approved public indexers. |
| **`Referrer-Policy`** | `strict-origin-when-cross-origin` | Protects URL query paths and state identifiers from leaking across third-party boundaries while preserving origin metadata on same-origin requests. |
| **`X-Content-Type-Options`** | `nosniff` | Disables MIME type sniffing, forcing user agents to adhere to explicit declared `Content-Type` headers. |
| **`X-Frame-Options`** | `DENY` | Hardens clickjacking defenses by prohibiting rendering within third-party or same-origin `<iframe>` contexts. |
| **`Permissions-Policy`** | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Explicitly disables unused and intrusive browser capabilities (camera, microphone, geolocation, interest cohort tracking). |

### Origin Allowlisting Details
- **Stellar Expert Links:** Navigations to Stellar Expert (`https://stellar.expert/explorer/...`) are top-level browser navigations (`<a href="..." target="_blank">`), not third-party script executions or iframes. They require no script origin grants, keeping client execution strictly isolated to `'self'`.
- **Public Adapters & Indexers:** Live TVL and metadata resolution services utilize `api.stellar.expert` and `api.llama.fi`, which are explicitly allowlisted in `connect-src`.
