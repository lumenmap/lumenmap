import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig, type Plugin } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboardMockPath = path.join(
  repoRoot,
  ".storybook/mocks/DashboardProvider.tsx",
);

/**
 * Swaps every import of the real `DashboardProvider` (which fetches live
 * activity data) for a fixture-only mock, regardless of whether the importer
 * uses the `@/` alias or a relative path.
 */
function mockDashboardProvider(): Plugin {
  return {
    name: "lumenmap:mock-dashboard-provider",
    enforce: "pre",
    resolveId(source) {
      if (/(^|\/)DashboardProvider(\.tsx)?$/.test(source)) {
        return dashboardMockPath;
      }
      return null;
    },
  };
}

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  framework: "@storybook/react-vite",
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: { alias: [{ find: /^@\//, replacement: `${repoRoot}/` }] },
      plugins: [mockDashboardProvider()],
    }),
};

export default config;
