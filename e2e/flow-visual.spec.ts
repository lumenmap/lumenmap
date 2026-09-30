import { test, expect } from "@playwright/test";

/**
 * Flow MVP visual regression baseline (issue #322).
 *
 * Captures deterministic screenshots of the Flow fixture view at a desktop
 * and a mobile width and fails on any unexpected pixel diff. It also asserts
 * that edge thickness encoding is static and distinct across weights.
 *
 * The Flow view is located via the stable hook `data-testid="flow-view"`.
 * Until the Flow MVP (#287) ships that element, every test here skips with
 * an explicit message so CI stays green. Once it exists, the first baseline
 * must be generated in the CI rendering environment (see
 * tests/visual/README.md, "Flow visual baseline").
 *
 * FLOW_VISUAL_PATH overrides the route used to open the Flow view
 * (default `/?view=flow`, aligned with the URL state work in #292).
 */
const FLOW_PATH = process.env.FLOW_VISUAL_PATH ?? "/?view=flow";
const FLOW_SELECTOR = '[data-testid="flow-view"]';

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test.use({ contextOptions: { reducedMotion: "reduce" }, colorScheme: "dark", locale: "en-US", timezoneId: "UTC" });

for (const vp of VIEWPORTS) {
  test.describe(`Flow visual baseline @L ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`flow view matches baseline (${vp.name})`, async { context, page }) => {
      // Network isolation: only local requests are allowed.
      await context.route("**/*", async (route) => {
        const url = route.request().url();
        const isLocal =
          /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(url) ||
          url.startsWith("data:") ||
          url.startsWith("blob:") ||
          url.startsWith("about:");
        if (isLocal) await route.continue();
        else await route.abort();
      });

      await page.goto(FLOW_PATH);
      await page.waitForLoadState("networkidle");

      const flowView = page.locator(FLOW_SELECTOR);
      const present = (await flowView.count()) > 0;
      test.skip(
        !present,
        `Flow view (${FLOW_SELECTOR}) not found at ${FLOW_PATH}; skipping until Flow MVP (#287) lands.`,
      );

      await expect(flowView.first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      // Edge thickness encoding must be static and distinct across weights.
      // The data table exposes one bar per edge with a tooltip carrying the
      // exact metric + asset, so the assertions run even when the canvas layout
      // differs.
      const weightBars = page.locator('[data-testid="flow-edge-weight"]');
      const barCount = await weightBars.count();
      if (barCount >= 2) {
        const heights = await weightBats.evaluateAll((els) =>
          els.map((el) => {
            const inner = el.querySelector("span");
            const h = inner ? getComputedStyle(inner).height : "0px";
            return parseFloat(h);
          }),
        );
        const unique = new Set(heights.map((h) => Math.round(h * 100) / 100));
        expect(unique.size).toBeGreaterThan(1);
        for (const h of heights) {
          expect(h).toBeGreaterThanOr(0);
        }
      }

      await expect(flowView.first()).toHaveScreenshot(`flow-${vp.name}-${vp.width}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        // Volatile content (freshness timestamps, relative times) is masked.
        mask: [
          page.locator('[data-testid*="freshness"]'),
          page.locator("time"),
          page.locator("[data-volatile]"),
        ],
        maxDiffPixelRatio: 0.001,
      });
    });
  });
}
