import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Browser-level regression suite for the primary dashboard journey.
 *
 * The suite runs the production server with `LUMENMAP_DATA_SOURCE=fixture`,
 * which serves deterministic fixture data: no GCP credentials, no BigQuery,
 * and no network access are required. External requests are additionally
 * blocked inside the tests to guarantee network isolation.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      // Deterministic fixture data; GCP credentials intentionally blank so
      // the suite can never depend on them.
      LUMENMAP_DATA_SOURCE: "fixture",
      GOOGLE_APPLICATION_CREDENTIALS: "",
      GCP_SERVICE_ACCOUNT_KEY: "",
    },
  },
});
