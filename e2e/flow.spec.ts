import { expect, test } from "@playwright/test";

test("fixture Flow view shows connected nodes without desktop overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?view=flow");
  const canvas = page.getByTestId("flow-canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-node-count", "5");
  await expect(canvas).toHaveAttribute("data-edge-count", "5");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});
