import { expect, test, type Page } from "@playwright/test";
import { GROUP_LABELS, TYPE_TO_GROUP } from "../lib/constants";
import {
  getFixtureRawActivity,
} from "../lib/fixtures/raw-data";
import type { Period } from "../lib/types";
import { formatNumber } from "../lib/utils";

/**
 * Browser-level regression coverage for shareable URL deep links (#254).
 *
 * Each test navigates directly to a URL containing query parameters
 * (`period`, `metric`, `view`, `path`) and asserts that the dashboard
 * restores the correct UI state — period selector, metric description,
 * hierarchy view, breadcrumbs, and treemap tiles.
 *
 * Invalid parameters are verified to fall back to defaults without
 * console errors, and stale drill paths resolve to the deepest valid
 * ancestor level.
 *
 * The app under test runs with `LUMENMAP_DATA_SOURCE=fixture` (configured
 * in playwright.config.ts), so every expected value is derived from the
 * same deterministic fixtures — no GCP credentials and no network access
 * required.
 */

/** All requests intercepted during a test that targeted a non-local URL. */
let externalRequests: string[];

/** Locates a treemap tile by the stable node name rendered by D3Treemap. */
function tile(page: Page, nodeName: string) {
  return page.locator(
    `[data-testid="treemap-tile"][data-node-name="${nodeName}"]`,
  );
}

function breadcrumbs(page: Page) {
  return page.getByTestId("treemap-breadcrumb");
}

function totalOps(period: Period): number {
  return getFixtureRawActivity(period).categories.reduce(
    (sum, row) => sum + row.op_count,
    0,
  );
}

test.describe("URL deep-link state restoration (#254)", () => {
  test.beforeEach(async ({ context }) => {
    externalRequests = [];

    // Network isolation: anything that is not localhost/data/blob is
    // aborted and recorded, proving the suite runs with network disabled.
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
  });

  test.afterEach(() => {
    expect(
      externalRequests,
      "dashboard attempted external network requests",
    ).toEqual([]);
  });

  test("restores period, metric, view, and two-level drill path from URL", async ({
    page,
  }) => {
    // Deep link: 7-day period, ops metric, events view, drilled into
    // Soroban Contracts → transfer (two-level path).
    await page.goto(
      "/?period=7d&metric=ops&view=events&path=Soroban%20Contracts/transfer",
    );

    // Wait for the 7-day fixture data to load and render.
    const expected7dTotal = formatNumber(totalOps("7d"));
    await expect(page.getByTestId("kpi-value-totalOps")).toHaveText(
      expected7dTotal,
    );

    // Period: "7 Days" radio button should be the active selection.
    await expect(
      page.getByRole("radio", { name: "7 Days" }),
    ).toHaveAttribute("aria-checked", "true");

    // View: "Operation Types" (events) should be selected.
    await expect(
      page.getByRole("radio", { name: "Operation Types" }),
    ).toHaveAttribute("aria-checked", "true");

    // Metric: ops description should be visible.
    await expect(
      page.getByText("Tile size is proportional to the number of operations."),
    ).toBeVisible();

    // Drill path: breadcrumbs reflect the two-level hierarchy.
    await expect(breadcrumbs(page)).toHaveText([
      "Network Activity",
      GROUP_LABELS.soroban,
      "transfer",
    ]);

    // At the "transfer" function level, contract tiles should be visible.
    await expect(tile(page, "Soroswap")).toBeVisible();
  });

  test("restores period and metric independently without a drill path", async ({
    page,
  }) => {
    // Deep link: 30-day period, XLM volume metric, no path.
    await page.goto("/?period=30d&metric=xlm_volume");

    const expected30dTotal = formatNumber(totalOps("30d"));
    await expect(page.getByTestId("kpi-value-totalOps")).toHaveText(
      expected30dTotal,
    );

    // Period: "30 Days" radio should be active.
    await expect(
      page.getByRole("radio", { name: "30 Days" }),
    ).toHaveAttribute("aria-checked", "true");

    // Metric: XLM volume description should be visible.
    await expect(
      page.getByText(/XLM payment volume/),
    ).toBeVisible();

    // Treemap stays at root level (no drill path in URL).
    await expect(breadcrumbs(page)).toHaveText(["Network Activity"]);
  });

  test("restores actors view from URL", async ({ page }) => {
    await page.goto("/?view=actors");

    // Wait for data to render.
    await expect(page.getByTestId("kpi-value-totalOps")).toBeVisible();

    // View: "Accounts & Contracts" should be selected.
    await expect(
      page.getByRole("radio", { name: "Accounts & Contracts" }),
    ).toHaveAttribute("aria-checked", "true");

    // Actors view description should be visible.
    await expect(page.getByText(/Drill into top wallets/)).toBeVisible();

    // Drilling into a category should reveal account/contract tiles
    // instead of operation-type tiles, confirming the view was applied.
    await tile(page, GROUP_LABELS.soroban).click();
    await expect(tile(page, "Soroswap")).toBeVisible();
    await expect(tile(page, "transfer")).toHaveCount(0);
  });

  test("invalid period param falls back to default without console errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate with a bogus period value.
    await page.goto("/?period=99d");

    // Should fall back to the default period (1d) and load successfully.
    const expected1dTotal = formatNumber(totalOps("1d"));
    await expect(page.getByTestId("kpi-value-totalOps")).toHaveText(
      expected1dTotal,
    );

    // Default period "Today" should be the active selection.
    await expect(
      page.getByRole("radio", { name: "Today" }),
    ).toHaveAttribute("aria-checked", "true");

    // No console errors triggered by the invalid parameter.
    expect(consoleErrors).toEqual([]);
  });

  test("invalid metric and view params fall back to defaults", async ({
    page,
  }) => {
    await page.goto("/?metric=bogus&view=nonexistent");

    await expect(page.getByTestId("kpi-value-totalOps")).toBeVisible();

    // Default metric (ops) description should be visible.
    await expect(
      page.getByText("Tile size is proportional to the number of operations."),
    ).toBeVisible();

    // Default view (events / Operation Types) should be checked.
    await expect(
      page.getByRole("radio", { name: "Operation Types" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("stale drill path restores to deepest valid ancestor level", async ({
    page,
  }) => {
    // First segment is valid (Soroban Contracts), second is stale/missing.
    await page.goto("/?path=Soroban%20Contracts/nonexistent_function");

    await expect(page.getByTestId("kpi-value-totalOps")).toBeVisible();

    // Should resolve to just the first valid level.
    await expect(breadcrumbs(page)).toHaveText([
      "Network Activity",
      GROUP_LABELS.soroban,
    ]);

    // Soroban function tiles should be visible at this level.
    await expect(tile(page, "transfer")).toBeVisible();
  });

  test("URL reflects restored state after hydration", async ({ page }) => {
    await page.goto("/?period=7d&metric=xlm_volume&view=actors");

    // Wait for data load to complete so the URL write-back effect runs.
    const expected7dTotal = formatNumber(totalOps("7d"));
    await expect(page.getByTestId("kpi-value-totalOps")).toHaveText(
      expected7dTotal,
    );

    // The browser address bar should carry the restored parameters.
    const url = new URL(page.url());
    expect(url.searchParams.get("period")).toBe("7d");
    expect(url.searchParams.get("metric")).toBe("xlm_volume");
    expect(url.searchParams.get("view")).toBe("actors");
  });

  test("completely empty path param does not create phantom breadcrumbs", async ({
    page,
  }) => {
    await page.goto("/?path=");

    await expect(page.getByTestId("kpi-value-totalOps")).toBeVisible();

    // Should stay at root — no extra breadcrumbs from the empty string.
    await expect(breadcrumbs(page)).toHaveText(["Network Activity"]);
  });
});
