import { expect, test } from "@playwright/test";

test.describe("experimental Flow route gate", () => {
  test("redirects a direct Flow URL while disabled", async ({ page }) => {
    await page.goto("/?view=flow");

    await expect(
      page.getByRole("heading", { name: "LumenMap", level: 1 }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  });

  test("allows the fixture query opt-in through the gate", async ({ page }) => {
    await page.goto("/?view=flow&flow=1");

    await expect(
      page.getByRole("heading", { name: "LumenMap", level: 1 }),
    ).toBeVisible();
    const url = new URL(page.url());
    expect(url.searchParams.get("view")).toBe("flow");
    expect(url.searchParams.get("flow")).toBe("1");
  });
});
