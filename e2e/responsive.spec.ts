import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 360, height: 700 },
  { width: 390, height: 700 },
] as const;

const MOCK_KPIS = {
  totalOps: 2150000,
  sorobanShare: 42.5,
  topCategory: "soroban",
  activeContracts: 89,
};

const MOCK_TREEMAP_NODE = (name: string, children?: unknown[]) => ({
  name,
  children: children ?? [
    {
      name: "Soroban",
      value: 903000,
      color: "#7B61FF",
      meta: { type: "category" },
      children: [
        {
          name: "invoke_host_function",
          value: 850000,
          color: "#7B61FF",
          meta: { type: "entity", category: "soroban", eventType: "invoke_host_function" },
        },
        {
          name: "extend_footprint_ttl",
          value: 53000,
          color: "#7B61FF",
          meta: { type: "entity", category: "soroban", eventType: "extend_footprint_ttl" },
        },
      ],
    },
    {
      name: "Payments",
      value: 645000,
      color: "#14B8A6",
      meta: { type: "category" },
      children: [
        {
          name: "payment",
          value: 610000,
          color: "#14B8A6",
          meta: { type: "entity", category: "payments", eventType: "payment" },
        },
        {
          name: "create_account",
          value: 35000,
          color: "#14B8A6",
          meta: { type: "entity", category: "payments", eventType: "create_account" },
        },
      ],
    },
    {
      name: "DEX",
      value: 322500,
      color: "#F59E0B",
      meta: { type: "category" },
      children: [
        {
          name: "manage_buy_offer",
          value: 180000,
          color: "#F59E0B",
          meta: { type: "entity", category: "dex", eventType: "manage_buy_offer" },
        },
      ],
    },
    {
      name: "Trustlines",
      value: 161250,
      color: "#3B82F6",
      meta: { type: "category" },
    },
    {
      name: "Account Ops",
      value: 86000,
      color: "#EC4899",
      meta: { type: "category" },
    },
    {
      name: "Other",
      value: 32250,
      color: "#6B7280",
      meta: { type: "category" },
    },
  ],
});

function mockApiResponse(page: Page) {
  return page.route("**/api/activity", async (route) => {
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
          events: MOCK_TREEMAP_NODE("Network Activity"),
          actors: MOCK_TREEMAP_NODE("Accounts & Contracts"),
        },
      }),
    });
  });
}

test.describe("responsive layout", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`at ${viewport.width}px viewport`, () => {
      test.beforeEach(({ page }) => {
        page.setViewportSize(viewport);
      });

      test("loading state: no horizontal scrollbar", async ({ page }) => {
        await mockApiResponse(page);
        await page.goto("/", { waitUntil: "commit" });

        await expect(page.locator("html")).toHaveCSS("overflow-x", "hidden");
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = viewport.width;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
      });

      test("loaded state: KPI cards, header, legend, and controls are visible without clipping", async ({ page }) => {
        await mockApiResponse(page);
        await page.goto("/");

        await expect(page.getByRole("heading", { name: "LumenMap" })).toBeVisible();
        await expect(page.getByText("Total Operations")).toBeVisible();
        await expect(page.getByText("Soroban Share")).toBeVisible();
        await expect(page.getByText("Top Category")).toBeVisible();
        await expect(page.getByText("Active Contracts")).toBeVisible();
        await expect(page.getByText("Network Treemap")).toBeVisible();
        await expect(page.getByText("Soroban").first()).toBeVisible();
        await expect(page.getByText("Payments").first()).toBeVisible();
        await expect(page.getByRole("radio", { name: "Operation Types" })).toBeVisible();

        await expect(page.locator("html")).toHaveCSS("overflow-x", "hidden");
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width);
      });

      test("loaded state: no horizontal overflow on any element", async ({ page }) => {
        await mockApiResponse(page);
        await page.goto("/");

        const overflowElements = await page.evaluate((vpWidth) => {
          const all = document.querySelectorAll("*");
          const overflowing: string[] = [];
          for (const el of all) {
            if (el.scrollWidth > el.clientWidth && el.scrollWidth > vpWidth * 0.5) {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : "";
              const cls = Array.from((el as HTMLElement).classList).slice(0, 2).join(".");
              overflowing.push(`${tag}${id}${cls ? `.${cls}` : ""} scrollW=${el.scrollWidth} clientW=${el.clientWidth}`);
            }
          }
          return overflowing.slice(0, 20);
        }, viewport.width);

        const allowedScrollContainers = overflowElements.filter(
          (s) =>
            s.includes("overflow-x-auto") ||
            s.includes("overflow-auto") ||
            s.includes("role=img") ||
            s.includes(".sr-only") ||
            s.includes("svg") ||
            s.includes("clientW=0")
        );

        expect(overflowElements.length - allowedScrollContainers.length).toBe(0);
      });

      test("details state: detail panel does not cause horizontal overflow", async ({ page }) => {
        await mockApiResponse(page);
        await page.goto("/");

        const tile = page.getByTestId("treemap-tile").first();
        await tile.click();

        await expect(page.getByTestId("detail-operations")).toBeVisible();
        await expect(page.getByText("Share (current level)")).toBeVisible();

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width);
      });

      test("error state: no horizontal scrollbar", async ({ page }) => {
        await page.route("**/api/activity", async (route) => {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Server error" }),
          });
        });

        await page.goto("/");

        await expect(page.getByText("Network Treemap")).toBeVisible();
        await expect(page.getByText(/Unable to load|Server error|\b500\b/i).first()).toBeVisible();

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width);
      });

      test("period selector buttons wrap", async ({ page }) => {
        await mockApiResponse(page);
        await page.goto("/");

        const periodButtons = page.locator("button:has-text('Today'), button:has-text('7 Days'), button:has-text('30 Days'), button:has-text('This Month')");
        await expect(periodButtons.first()).toBeVisible();
        await expect(periodButtons.nth(1)).toBeVisible();
        await expect(periodButtons.nth(2)).toBeVisible();
        await expect(periodButtons.nth(3)).toBeVisible();
      });

      test("primary Flow controls meet 44px touch target minimum", async ({ page }) => {
        await mockApiResponse(page);
        await page.goto("/");

        const controls = page.locator('button, [role="button"], a[href]');
        const count = await controls.count();
        const tooSmall: string[] = [];

        for (let i = 0; i < count; i++) {
          const control = controls.nth(i);
          if (!(await control.isVisible())) continue;
          const box = await control.boundingBox();
          if (!box) continue;
          if (box.width < 44 || box.height < 44) {
            const text = (await control.innerText()).trim().slice(0, 20);
            tooSmall.push(`${text} ${Math.round(box.width)}x${Math.round(box.height)}`);
          }
        }

        expect(tooSmall, `too small: ${tooSmall.join(", ")}`).toHaveLength(0);
      });
    });
  }
})
