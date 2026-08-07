import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Component token tests only. Lib/API suites run via `npm test` (tsx).
    include: ["components/**/*.test.tsx"],
  },
});
