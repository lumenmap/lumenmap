import { expect, test } from "@playwright/test";

test.describe("Mobile bottom-sheet DetailPanel (#452)", () => {
  test("renders DetailPanel as a bottom sheet without horizontal overflow at 390px and closes on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const tile = page.locator("[id^='node-']").first();
    await tile.click();

    const sheet = page.getByTestId("detail-bottom-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("role", "dialog");
    await expect(sheet).toHaveAttribute("aria-modal", "true");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(true);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });
});
