import { expect, test, type Page } from "@playwright/test";
import { GROUP_LABELS, TYPE_TO_GROUP } from "../lib/constants";
import {
  getFixtureRawActivity,
  getFixturePreviousRawActivity,
} from "../lib/fixtures/raw-data";
import { classifyDelta } from "../lib/treemap-diff";

/**
 * Browser-level coverage for the treemap period-over-period diff overlay
 * (issue #447), running against the deterministic fixture data
 * (`LUMENMAP_DATA_SOURCE=fixture`, see playwright.config.ts).
 *
 * Expected values are derived from the same fixture rows the API serves:
 * the previous window scales specific rows (see
 * `getFixturePreviousRawActivity`), so every diverging bucket — growth,
 * decline, new, dropped, flat — is reproducible without network access.
 */

let externalRequests: string[];

function tile(page: Page, nodeName: string) {
  return page.locator(
    `[data-testid="treemap-tile"][data-node-name="${nodeName}"]`,
  );
}

function groupTotal(
  activity: ReturnType<typeof getFixtureRawActivity>,
  group: string,
): number {
  return activity.categories
    .filter((row) => (TYPE_TO_GROUP[row.type_string] ?? "other") === group)
    .reduce((sum, row) => sum + row.op_count, 0);
}

function expectedDiffForGroup(group: string) {
  const current = groupTotal(getFixtureRawActivity("1d"), group);
  const previous = groupTotal(getFixturePreviousRawActivity("1d"), group);
  const percent = ((current - previous) / previous) * 100;
  return { kind: classifyDelta(current, previous), percentText: percent.toFixed(1) };
}

/** Signed percent text exactly as the table's delta cell renders it. */
function signedPercentCellText(group: string): string {
  const { percentText } = expectedDiffForGroup(group);
  const sign = percentText.startsWith("-") ? "" : "+";
  return `(${sign}${percentText}%)`;
}

test.describe("Treemap period-over-period diff overlay (issue #447)", () => {
  test.beforeEach(async ({ context, page }) => {
    externalRequests = [];

    // Network isolation: anything not localhost is aborted and recorded.
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
      "diff overlay attempted external network requests",
    ).toEqual([]);
  });

  test("diff toggle colors tiles by change and round-trips the URL flag", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("kpi-value-totalOps")).toBeVisible();

    const toggle = page.getByTestId("treemap-diff-toggle");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();
    await expect(page).toHaveURL(/diff=1/);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // The legend appears once the previous window has loaded; it documents
    // every bucket, so it is also the wait for the diff fetch.
    const legend = page.getByTestId("treemap-diff-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("Growth ≥ +50%");
    // The note beside the swatches documents the dropped-tile handling.
    await expect(page.getByText(/listed as/)).toContainText("Dropped");

    // Every root-level category tile carries the expected bucket and
    // percent, computed from the same fixture rows the API served.
    for (const [group, label] of Object.entries(GROUP_LABELS)) {
      const expected = expectedDiffForGroup(group);
      const groupTile = tile(page, label);
      await expect(groupTile).toHaveAttribute("data-diff-kind", expected.kind);
      await expect(groupTile).toHaveAttribute(
        "data-diff-percent",
        expected.percentText,
      );
    }

    // Color is not the only encoding: the tooltip states the signed change.
    await tile(page, GROUP_LABELS.payments).hover();
    const tooltipDelta = page.getByTestId("treemap-tooltip-delta");
    await expect(tooltipDelta).toBeVisible();
    await expect(tooltipDelta).toContainText("vs previous window");

    // The table gains a sortable delta column with signed text.
    await expect(page.getByText("Δ vs prev")).toBeVisible();
    await expect(
      page.locator('[data-testid="treemap-delta-cell"]', {
        hasText: signedPercentCellText("payments"),
      }),
    ).toHaveCount(1);

    // Toggling off clears the flag and removes the overlay.
    await toggle.click();
    await expect(page).not.toHaveURL(/diff=1/);
    await expect(legend).not.toBeVisible();
    await expect(
      page.locator('[data-testid="treemap-tile"][data-diff-kind]'),
    ).toHaveCount(0);
  });

  test("the diff URL flag enables the overlay without clicking", async ({
    page,
  }) => {
    await page.goto("/?diff=1");
    await expect(page.getByTestId("kpi-value-totalOps")).toBeVisible();

    await expect(
      page.getByTestId("treemap-diff-toggle"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("treemap-diff-legend")).toBeVisible();
    await expect(tile(page, GROUP_LABELS.soroban)).toHaveAttribute(
      "data-diff-kind",
      "declined",
    );
  });

  test("new contracts get a New tile and dropped contracts a Dropped row", async ({
    page,
  }) => {
    await page.goto("/?diff=1&view=actors");
    await expect(page.getByTestId("kpi-value-totalOps")).toBeVisible();
    await expect(page.getByTestId("treemap-diff-legend")).toBeVisible();

    // Drill into the Soroban contracts group (actors view level 2).
    await tile(page, GROUP_LABELS.soroban).click();
    await expect(page.getByTestId("treemap-breadcrumb").last()).toHaveText(
      GROUP_LABELS.soroban,
    );

    // "Soroswap Router" only exists in the current window: new tile.
    await expect(tile(page, "Soroswap Router")).toHaveAttribute(
      "data-diff-kind",
      "new",
    );
    await expect(tile(page, "Soroswap Router")).toHaveAttribute(
      "data-diff-percent",
      "new",
    );

    // "Soroswap" declined 20% (previous window was 1.25x).
    await expect(tile(page, "Soroswap")).toHaveAttribute(
      "data-diff-kind",
      "declined",
    );
    await expect(tile(page, "Soroswap")).toHaveAttribute(
      "data-diff-percent",
      "-20.0",
    );

    // The dropped contract has no tile (zero value cannot occupy treemap
    // space); it is appended to the table with a badge and -100% delta.
    const droppedRow = page.getByTestId("treemap-dropped-row");
    await expect(droppedRow).toBeVisible();
    await expect(droppedRow).toContainText("Dropped");
    await expect(droppedRow).toContainText("(-100.0%)");
    await expect(droppedRow).toContainText("Not in current window");

    // The new row states it in text, not only in color.
    await expect(
      page.getByRole("row", { name: /Soroswap Router/ }),
    ).toContainText("New");
  });
});
