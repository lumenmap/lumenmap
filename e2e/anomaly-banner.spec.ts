import { test, expect } from "@playwright/test";

test("fixture spike renders a dismissible anomaly banner", async ({ page }) => {
  await page.goto("/?anomaly=spike");
  const banner = page.getByTestId("anomaly-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Operations");
  await page.keyboard.press("Escape");
  await expect(banner).toHaveCount(0);
});

test("quiet fixture does not render an anomaly banner", async ({ page }) => {
  await page.goto("/?anomaly=quiet");
  await expect(page.getByTestId("anomaly-banner")).toHaveCount(0);
});
