import { expect, test } from "@playwright/test";

test.describe("DetailPanel responsive presentation", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("treemap-tile").first()).toBeVisible();
  });

  test("opens an accessible, trapped sheet without horizontal overflow and closes with Escape", async ({ page }) => {
    const tile = page.getByTestId("treemap-tile").first();
    await tile.click();
    const sheet = page.getByRole("dialog", { name: /^Details:/ });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    await expect(page.getByTestId("detail-operations")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("dialog");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect.poll(() => page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(390);

    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect(tile).toBeFocused();
  });

  test("supports backdrop, swipe handle, and reduced motion", async ({ page }) => {
    await page.getByTestId("treemap-tile").first().click();
    const sheet = page.getByTestId("detail-sheet");
    await expect(sheet).toHaveCSS("animation-name", "none");
    await page.getByTestId("detail-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(sheet).toBeHidden();

    await page.getByTestId("treemap-tile").first().click();
    const handle = page.getByRole("button", { name: "Dismiss details" });
    await handle.evaluate((element) => {
      const start = new Touch({ identifier: 1, target: element, clientY: 100 });
      const end = new Touch({ identifier: 1, target: element, clientY: 180 });
      element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start] }));
      element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }));
    });
    await expect(sheet).toBeHidden();
  });

  test("390px visual snapshot and sheet geometry", async ({ page }, testInfo) => {
    await page.getByTestId("treemap-tile").first().click();
    const sheet = page.getByTestId("detail-sheet");
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBe(0);
    expect(box!.width).toBe(390);
    expect(Math.round(box!.y + box!.height)).toBe(844);
    await testInfo.attach("detail-sheet-390", {
      body: await page.screenshot({ animations: "disabled", caret: "hide" }),
      contentType: "image/png",
    });
  });
});

test("desktop keeps the side column", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("treemap-tile").first().click();
  const panel = page.getByTestId("detail-sheet");
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveAttribute("role", "dialog");
  await expect(panel).toHaveCSS("position", "static");
  await expect(page.getByTestId("detail-backdrop")).toBeHidden();
});
