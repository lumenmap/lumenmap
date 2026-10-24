# Progressive Web App (PWA) & Offline Shell

LumenMap includes an installable Progressive Web App (PWA) shell and offline caching capabilities to support researchers working in the field, mobile environments, or over flaky network connections.

## Key Capabilities

1. **Installable Web App**: Meets Lighthouse PWA installability criteria. Can be installed directly to the home screen or desktop application dock from modern Chromium-based browsers (Chrome, Edge, Brave), Safari iOS, and Android browsers.
2. **Offline Shell & Dashboard Caching**: Precaches core static shell assets and caches the last-successful activity JSON payload (bounded to 20 entries) using CacheStorage in the Service Worker.
3. **Transparent Staleness & Offline Banner**: When offline or serving from the local service worker cache, LumenMap clearly distinguishes stale cached data from live network data:
   - An offline alert banner (`data-testid="offline-stale-banner"`) indicates that cached data is currently shown.
   - The freshness indicator displays a distinct `cached` freshness chip (`data-testid="freshness-cached-chip"`).
   - The exact upstream data watermark (`sourceTimestamp`) is preserved and displayed.
4. **Visual Token Compliance**: Uses LumenMap dark theme visual tokens (`bg-surface-soft`, `text-amber-300`, `border-border`, `bg-background`).

---

## Installing the PWA

### Chromium Browsers (Google Chrome, Microsoft Edge, Brave)
1. Navigate to the LumenMap dashboard URL in your browser.
2. Look for the **Install** icon in the address bar (or select the browser menu `⋮` / `…` -> **Install LumenMap**).
3. Click **Install**. LumenMap will launch in a dedicated standalone window with custom branding and dark title bar.

### Mobile (Android Chrome)
1. Open LumenMap in Chrome on your Android device.
2. Tap the browser menu `⋮` -> **Add to Home screen** / **Install app**.
3. Confirm the prompt. The app icon will appear on your home screen and app drawer.

### Mobile (iOS Safari)
1. Open LumenMap in Safari on your iPhone or iPad.
2. Tap the **Share** button (box with upward arrow).
3. Scroll down and select **Add to Home Screen**.
4. Tap **Add** in the top-right corner.

---

## Service Worker Configuration & Environment Flags

By default, the service worker is **disabled in development** (`NODE_ENV === "development"`) so development hot reloading and asset bundling are uninterrupted.

You can customize this behavior via environment variables:

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | When `development`, SW registration is bypassed and existing registrations are cleaned up. | `development` / `production` |
| `NEXT_PUBLIC_DISABLE_SW` | Set to `1` or `true` to forcefully disable SW registration in any environment. | `false` |
| `NEXT_PUBLIC_ENABLE_SW` | Set to `1` or `true` to test SW caching in development without running a full production build. | `false` |

---

## Verification & Testing

### Automated Playwright E2E Offline Test
Run the dedicated offline suite:
```bash
npx playwright test e2e/pwa-offline.spec.ts
```

### Manual Testing on Chromium
1. Build and start the production server:
   ```bash
   npm run build
   npm run start
   ```
2. Open Chrome DevTools -> **Application** tab:
   - Check **Manifest**: Verify identity, icons (192px, 512px, maskable), standalone display, and theme colors.
   - Check **Service Workers**: Confirm `sw.js` is active and running.
   - Run **Lighthouse** audit: Select "PWA" and verify installable criteria are satisfied.
3. Simulate offline network:
   - Go to DevTools -> **Network** tab -> toggle **Offline**.
   - Reload the dashboard: Verify the application shell loads, displays the last-successful activity data, renders the offline alert banner, and presents the `cached` freshness chip.
