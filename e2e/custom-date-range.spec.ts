import { expect, test, type Page } from "@playwright/test";

/**
 * Browser-level tests for custom date-range picker (issue #444).
 * Validates UI interactions, URL state persistence, and API integration
 * in fixture mode.
 */

let externalRequests: string[];

test.describe("Custom date range picker (issue #444)", () => {
  test.beforeEach(async ({ context, page }) => {
    externalRequests = [];

    // Network isolation: abort non-local requests
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      const isLocal =
        /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(url) ||
        url.startsWith("data:") ||
        url.startsWith("blob:") ||
        url.startsWith("about:");

      if (isLocal) {
        await route.continue();
        return;
      }

      externalRequests.push(url);
      await route.abort();
    });

    await page.goto("/");
    await page.waitForSelector('[data-testid="treemap-container"]');
  });

  test.afterEach(() => {
    expect(
      externalRequests,
      "No external network requests should escape localhost",
    ).toHaveLength(0);
  });

  test("custom period button opens date picker", async ({ page }) => {
    // Find and click Custom button
    await page.getByRole("radio", { name: /^Custom/ }).click();

    // Date picker should be visible
    await expect(page.getByLabel("Custom date range picker")).toBeVisible();
    await expect(page.getByLabel("Start Date (UTC)")).toBeVisible();
    await expect(page.getByLabel("End Date (UTC)")).toBeVisible();
  });

  test("applies valid custom date range and fetches data", async ({ page }) => {
    // Open picker
    await page.getByRole("radio", { name: /^Custom/ }).click();

    // Fill in dates
    await page.getByLabel("Start Date (UTC)").fill("2024-01-01");
    await page.getByLabel("End Date (UTC)").fill("2024-01-07");

    // Wait for API call when Apply is clicked
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/activity?period=custom:2024-01-01:2024-01-07") &&
        response.status() === 200,
    );

    await page.getByRole("button", { name: "Apply" }).click();
    await responsePromise;

    // Picker should close
    await expect(page.getByLabel("Custom date range picker")).not.toBeVisible();

    // Custom button should show active state
    const customButton = page.getByRole("radio", { name: /2024-01-01/ });
    await expect(customButton).toHaveAttribute("aria-checked", "true");
  });

  test("displays error for inverted date range", async ({ page }) => {
    await page.getByRole("radio", { name: /^Custom/ }).click();

    // Enter inverted dates (end before start)
    await page.getByLabel("Start Date (UTC)").fill("2024-01-31");
    await page.getByLabel("End Date (UTC)").fill("2024-01-01");
    await page.getByRole("button", { name: "Apply" }).click();

    // Error should appear
    await expect(page.getByRole("alert")).toContainText("before or equal");

    // Picker should stay open
    await expect(page.getByLabel("Custom date range picker")).toBeVisible();
  });

  test("displays error for range exceeding 90 days", async ({ page }) => {
    await page.getByRole("radio", { name: /^Custom/ }).click();

    await page.getByLabel("Start Date (UTC)").fill("2024-01-01");
    await page.getByLabel("End Date (UTC)").fill("2024-05-01"); // ~120 days
    await page.getByRole("button", { name: "Apply" }).click();

    // Error should mention max days
    await expect(page.getByRole("alert")).toContainText("90 days");
    await expect(page.getByLabel("Custom date range picker")).toBeVisible();
  });

  test("cancel button closes picker without applying", async ({ page }) => {
    await page.getByRole("radio", { name: /^Custom/ }).click();

    await page.getByLabel("Start Date (UTC)").fill("2024-01-01");
    await page.getByLabel("End Date (UTC)").fill("2024-01-07");

    // Click cancel instead of apply
    await page.getByRole("button", { name: "Cancel" }).click();

    // Picker should close
    await expect(page.getByLabel("Custom date range picker")).not.toBeVisible();

    // Active period should still be the default (1d)
    const todayButton = page.getByRole("radio", { name: "Today" });
    await expect(todayButton).toHaveAttribute("aria-checked", "true");
  });

  test("custom range persists in URL", async ({ page }) => {
    await page.getByRole("radio", { name: /^Custom/ }).click();
    await page.getByLabel("Start Date (UTC)").fill("2024-02-15");
    await page.getByLabel("End Date (UTC)").fill("2024-02-29");

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes("period=custom:2024-02-15:2024-02-29"),
    );
    await page.getByRole("button", { name: "Apply" }).click();
    await responsePromise;

    // Check URL includes custom period
    expect(page.url()).toContain("period=custom%3A2024-02-15%3A2024-02-29");

    // Reload page and verify custom period is restored
    await page.reload();
    await page.waitForSelector('[data-testid="treemap-container"]');

    // Custom button should show the date range
    const customButton = page.getByRole("radio", { name: /2024-02-15/ });
    await expect(customButton).toHaveAttribute("aria-checked", "true");
  });

  test("escape key closes picker", async ({ page }) => {
    await page.getByRole("radio", { name: /^Custom/ }).click();
    await expect(page.getByLabel("Custom date range picker")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByLabel("Custom date range picker")).not.toBeVisible();
  });

  test("enter key applies date range", async ({ page }) => {
    await page.getByRole("radio", { name: /^Custom/ }).click();

    await page.getByLabel("Start Date (UTC)").fill("2024-03-01");
    await page.getByLabel("End Date (UTC)").fill("2024-03-07");

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes("period=custom:2024-03-01:2024-03-07"),
    );

    // Press Enter in the end date field
    await page.getByLabel("End Date (UTC)").press("Enter");
    await responsePromise;

    await expect(page.getByLabel("Custom date range picker")).not.toBeVisible();
  });

  test("mobile layout does not overflow", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.getByRole("radio", { name: /^Custom/ }).click();

    const picker = page.getByLabel("Custom date range picker");
    await expect(picker).toBeVisible();

    // Check picker fits within viewport
    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();
    if (pickerBox) {
      expect(pickerBox.x).toBeGreaterThanOrEqual(0);
      expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(375);
    }
  });

  test("fixture mode returns deterministic data for custom range", async ({ page }) => {
    await page.getByRole("radio", { name: /^Custom/ }).click();

    // 7-day custom range
    await page.getByLabel("Start Date (UTC)").fill("2024-01-01");
    await page.getByLabel("End Date (UTC)").fill("2024-01-07");

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes("period=custom:2024-01-01:2024-01-07"),
    );
    await page.getByRole("button", { name: "Apply" }).click();
    const response = await responsePromise;

    // Verify response is successful
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.period).toBe("custom:2024-01-01:2024-01-07");
    expect(body.start).toBe("2024-01-01T00:00:00.000Z");
    expect(body.end).toBe("2024-01-07T23:59:59.999Z");
    expect(body.source).toBe("fixture");

    // Fixture data should be scaled by day count (7 days)
    expect(body.kpis.totalOps.value).toBeGreaterThan(0);
  });

  test("displays max range hint text", async ({ page }) => {
    await page.getByRole("radio", { name: /^Custom/ }).click();

    // Check for max range hint
    await expect(page.getByText(/Maximum range:.*90 days/)).toBeVisible();
  });
});
