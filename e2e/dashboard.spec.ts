import { expect, test, type Page } from "@playwright/test";
import { GROUP_LABELS, TYPE_TO_GROUP } from "../lib/constants";
import {
  FIXTURE_ACCOUNTS,
  FIXTURE_CONTRACTS,
  getFixtureRawActivity,
} from "../lib/fixtures/raw-data";
import type { Period } from "../lib/types";
import { formatNumber, formatPercent } from "../lib/utils";

/**
 * Browser-level regression coverage for the primary dashboard journey:
 * initial load, metric (period) changes, hierarchy view changes, treemap
 * select/drill-down, breadcrumb navigation, and the details panel.
 *
 * The app under test runs with `LUMENMAP_DATA_SOURCE=fixture` (configured
 * in playwright.config.ts), so every expected value below is derived from
 * the same deterministic fixtures — no GCP credentials and no network
 * access required. Any request that escapes localhost is aborted and
 * fails the test.
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

/** Mirrors the app grouping so expectations match the rendered numbers. */
function groupForType(type: string): string {
  return TYPE_TO_GROUP[type] ?? "other";
}

function groupTotal(period: Period, group: string): number {
  return getFixtureRawActivity(period)
    .categories.filter((row) => groupForType(row.type_string) === group)
    .reduce((sum, row) => sum + row.op_count, 0);
}

function totalOps(period: Period): number {
  return getFixtureRawActivity(period).categories.reduce(
    (sum, row) => sum + row.op_count,
    0,
  );
}

function activeContracts(period: Period): number {
  return getFixtureRawActivity(period).contracts.length;
}

function shareOf(part: number, whole: number): string {
  return formatPercent(whole > 0 ? (part / whole) * 100 : 0);
}

async function selectPeriod(page: Page, label: string, period: Period) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/activity?period=${period}`) &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: label }).click();
  const response = await responsePromise;
  // URL state: the period is carried by the API request URL.
  const url = new URL(response.request().url());
  expect(url.searchParams.get("period")).toBe(period);
}

test.describe("LumenMap dashboard user journey", () => {
  test.beforeEach(async ({ context, page }) => {
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

    await page.goto("/");
    // Data loaded implies the app is hydrated and interactive.
    await expect(page.getByTestId("kpi-value-totalOps")).toBeVisible();
  });

  test.afterEach(() => {
    expect(
      externalRequests,
      "dashboard attempted external network requests",
    ).toEqual([]);
  });

  test("initial dashboard load shows fixture KPIs, treemap, and breadcrumbs", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "LumenMap", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Local fixture data")).toBeVisible();

    // KPI cards render the deterministic fixture values.
    const total = totalOps("1d");
    await expect(page.getByTestId("kpi-value-totalOps")).toHaveText(
      formatNumber(total),
    );
    await expect(page.getByTestId("kpi-value-sorobanShare")).toHaveText(
      shareOf(groupTotal("1d", "soroban"), total),
    );
    await expect(page.getByTestId("kpi-value-topCategory")).toHaveText(
      GROUP_LABELS.soroban,
    );
    await expect(page.getByTestId("kpi-value-activeContracts")).toHaveText(
      formatNumber(activeContracts("1d")),
    );

    // The SVG treemap renders one tile per activity category.
    await expect(
      page.getByRole("img", { name: "Network activity treemap" }),
    ).toBeVisible();
    await expect(page.getByTestId("treemap-tile")).toHaveCount(6);
    for (const label of Object.values(GROUP_LABELS)) {
      await expect(tile(page, label)).toBeVisible();
    }

    // Hierarchy starts at the root breadcrumb with an empty details panel.
    await expect(breadcrumbs(page)).toHaveText(["Network Activity"]);
    await expect(page.getByTestId("detail-empty")).toBeVisible();
  });

  test("switching metrics (periods) refetches and updates visible data", async ({
    page,
  }) => {
    const initialTotal = await page
      .getByTestId("kpi-value-totalOps")
      .textContent();

    // 1d -> 7d: KPIs update, and the request URL carries the period state.
    await selectPeriod(page, "7 Days", "7d");
    const sevenDayTotal = totalOps("7d");
    await expect(page.getByTestId("kpi-value-totalOps")).toHaveText(
      formatNumber(sevenDayTotal),
    );
    expect(formatNumber(sevenDayTotal)).not.toBe(initialTotal);

    // Tile-level data reflects the new metric too.
    await tile(page, GROUP_LABELS.payments).click();
    await expect(page.getByTestId("detail-operations")).toHaveText(
      formatNumber(groupTotal("7d", "payments")),
    );
    await expect(page.getByTestId("detail-share")).toHaveText(
      shareOf(groupTotal("7d", "payments"), sevenDayTotal),
    );
    await expect(page.getByText("Last 7 days")).toBeVisible();

    // 7d -> 30d: KPIs update again; selection and drill state reset.
    await selectPeriod(page, "30 Days", "30d");
    await expect(page.getByTestId("kpi-value-totalOps")).toHaveText(
      formatNumber(totalOps("30d")),
    );
    await expect(page.getByTestId("detail-empty")).toBeVisible();
    await expect(breadcrumbs(page)).toHaveText(["Network Activity"]);

    // The dashboard currently keeps journey state in components, not in the
    // page URL — verify only where URL state exists (the API request above).
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("switching hierarchy views changes the visible treemap data", async ({
    page,
  }) => {
    // Operation Types view (default): category -> Soroban function.
    await expect(
      page.getByText(/operation type or Soroban function/),
    ).toBeVisible();
    await tile(page, GROUP_LABELS.soroban).click();
    await expect(tile(page, "transfer")).toBeVisible();
    await expect(page.getByTestId("detail-title")).toHaveText(
      GROUP_LABELS.soroban,
    );
    await breadcrumbs(page).nth(0).click();

    // Accounts & Contracts view: category -> contracts/accounts instead.
    await page
      .getByRole("button", { name: "Accounts & Contracts" })
      .click();
    await expect(page.getByText(/Drill into top wallets/)).toBeVisible();
    // Changing views clears the previous selection.
    await expect(page.getByTestId("detail-empty")).toBeVisible();

    await tile(page, GROUP_LABELS.soroban).click();
    await expect(tile(page, "Soroswap")).toBeVisible();
    await expect(tile(page, "transfer")).toHaveCount(0);

    // Contract leaf details come from the local entity registry.
    await tile(page, "Soroswap").click();
    await expect(page.getByTestId("detail-title")).toHaveText("Soroswap");
    await expect(page.getByTestId("detail-protocol")).toHaveText("Soroswap");
    await expect(page.getByTestId("detail-address")).toHaveText(
      FIXTURE_CONTRACTS.soroswap,
    );
    await expect(page.getByTestId("detail-operations")).toHaveText(
      formatNumber(150_000),
    );

    // Switching back restores the operation-type hierarchy.
    await page.getByRole("button", { name: "Operation Types" }).click();
    await expect(
      page.getByText(/operation type or Soroban function/),
    ).toBeVisible();
    await tile(page, GROUP_LABELS.soroban).click();
    await expect(tile(page, "transfer")).toBeVisible();
  });

  test("selected tile details match the active tile", async ({ page }) => {
    const total = totalOps("1d");
    const payments = groupTotal("1d", "payments");

    // Select a category tile.
    await tile(page, GROUP_LABELS.payments).click();
    await expect(page.getByTestId("detail-title")).toHaveText(
      GROUP_LABELS.payments,
    );
    await expect(page.getByTestId("detail-operations")).toHaveText(
      formatNumber(payments),
    );
    await expect(page.getByTestId("detail-share")).toHaveText(
      shareOf(payments, total),
    );
    // A category has no protocol or address.
    await expect(page.getByTestId("detail-protocol")).toHaveCount(0);
    await expect(page.getByTestId("detail-address")).toHaveCount(0);

    // Close the panel, then select a leaf tile two levels down.
    await page.getByRole("button", { name: "Close details" }).click();
    await expect(page.getByTestId("detail-empty")).toBeVisible();

    await tile(page, "payment").click();
    await expect(page.getByTestId("detail-event-type")).toHaveText("payment");

    await tile(page, "Kraken").click();
    await expect(page.getByTestId("detail-title")).toHaveText("Kraken");
    await expect(page.getByTestId("detail-operations")).toHaveText(
      formatNumber(90_000),
    );
    await expect(page.getByTestId("detail-share")).toHaveText(
      shareOf(90_000, 170_000),
    );
    await expect(page.getByTestId("detail-address")).toHaveText(
      FIXTURE_ACCOUNTS.kraken,
    );
    await expect(page.getByTestId("detail-protocol")).toHaveText("Kraken");
  });

  test("treemap drill-down and breadcrumb navigation restore hierarchy levels", async ({
    page,
  }) => {
    await expect(breadcrumbs(page)).toHaveText(["Network Activity"]);

    // Drill: root -> category -> Soroban function -> contracts.
    await tile(page, GROUP_LABELS.soroban).click();
    await expect(breadcrumbs(page)).toHaveText([
      "Network Activity",
      GROUP_LABELS.soroban,
    ]);
    await expect(tile(page, "transfer")).toBeVisible();
    await expect(tile(page, GROUP_LABELS.payments)).toHaveCount(0);

    await tile(page, "transfer").click();
    await expect(breadcrumbs(page)).toHaveText([
      "Network Activity",
      GROUP_LABELS.soroban,
      "transfer",
    ]);
    await expect(tile(page, "Soroswap")).toBeVisible();
    await expect(page.getByTestId("detail-title")).toHaveText("transfer");
    await expect(page.getByTestId("detail-event-type")).toHaveText("transfer");
    await expect(page.getByText("Contract function")).toBeVisible();

    // Breadcrumb jump back to the category level.
    await breadcrumbs(page).nth(1).click();
    await expect(breadcrumbs(page)).toHaveText([
      "Network Activity",
      GROUP_LABELS.soroban,
    ]);
    await expect(tile(page, "transfer")).toBeVisible();

    // Breadcrumb jump back to the root level.
    await breadcrumbs(page).nth(0).click();
    await expect(breadcrumbs(page)).toHaveText(["Network Activity"]);
    await expect(page.getByTestId("treemap-tile")).toHaveCount(6);
    await expect(tile(page, GROUP_LABELS.payments)).toBeVisible();
  });
});
