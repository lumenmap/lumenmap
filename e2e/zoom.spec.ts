import { test, expect, type Page } from "@playwright/test";

/** Desktop viewport before applying 200% browser zoom. */
const DESKTOP = { width: 1280, height: 800 } as const;

const MOCK_KPIS = {
  totalOps: 2150000,
  sorobanShare: 42.5,
  topCategory: "soroban",
  activeContracts: 89,
};

const MOCK_TREEMAP_NODE = {
  name: "Network Activity",
  children: [
    {
      name: "Soroban",
      value: 903000,
      color: "#7B61FF",
      meta: { type: "category", category: "soroban" },
      children: [
        {
          name: "invoke_host_function",
          value: 850000,
          color: "#7B61FF",
          meta: {
            type: "entity",
            category: "soroban",
            eventType: "invoke_host_function",
            nodeId: "invoke_host_function",
          },
        },
      ],
    },
    {
      name: "Payments",
      value: 645000,
      color: "#14B8A6",
      meta: { type: "category", category: "payments" },
    },
  ],
};

async function mockApiResponse(page: Page) {
  await page.route("**/api/activity*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        period: "1d",
        start: "2026-07-29T00:00:00.000Z",
        end: "2026-07-29T23:59:59.000Z",
        source: "hubble",
        categories: [],
        contracts: [],
        accounts: [],
        sorobanFunctions: [],
        sorobanFunctionContracts: [],
        kpis: MOCK_KPIS,
        treemaps: {
          events: MOCK_TREEMAP_NODE,
          actors: MOCK_TREEMAP_NODE,
        },
      }),
    });
  });
}

/** Emulate 200% browser zoom via Chromium page scale. */
async function setBrowserZoom(page: Page, scale: number) {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: scale });
}

test.describe("200% browser zoom", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await mockApiResponse(page);
  });

  test("dashboard reflows without page-level horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "LumenMap" })).toBeVisible();
    await setBrowserZoom(page, 2);

    await expect(page.getByText("Network Treemap")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Time period" })).toBeVisible();
    await expect(page.getByText("Operation Types")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("treemap and data table remain reachable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Network Treemap")).toBeVisible();
    await setBrowserZoom(page, 2);

    const treemap = page.locator('[data-treemap-container="true"]');
    await expect(treemap).toBeVisible();
    await treemap.scrollIntoViewIfNeeded();

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await table.scrollIntoViewIfNeeded();

    const box = await table.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(0);
  });

  test("detail panel stays usable after tile selection", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Network Treemap")).toBeVisible();
    await setBrowserZoom(page, 2);

    await page.locator("svg g").first().click();
    await expect(page.getByText("Share (current level)")).toBeVisible();

    const panel = page.locator("#detail-panel-container");
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeVisible();

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
});
