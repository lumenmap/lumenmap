/**
 * Regression test: verify that horizontal overflow protections are in place
 * for 320–390 pixel viewports.
 *
 * Checks:
 *  - globals.css has overflow-x: hidden and max-width: 100vw on html/body
 *  - D3Treemap.tsx does NOT contain a 320px minimum width in ResizeObserver
 *  - key containers have max-w-full or overflow-x-hidden classes
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

function fileContains(filePath, needle) {
  try {
    const content = readFileSync(resolve(root, filePath), "utf8");
    return content.includes(needle);
  } catch {
    return false;
  }
}

function fileDoesNotContain(filePath, needle) {
  try {
    const content = readFileSync(resolve(root, filePath), "utf8");
    return !content.includes(needle);
  } catch {
    return false;
  }
}

console.log("\n🔍 Responsive Overflow Regression Tests\n");

// 1. globals.css: html/body block has overflow-x: hidden
assert(
  fileContains("app/globals.css", "overflow-x: hidden") &&
    fileContains("app/globals.css", "max-width: 100vw"),
  "globals.css sets overflow-x: hidden and max-width: 100vw on html/body",
);

// 2. D3Treemap.tsx: should NOT contain Math.max(..., 320) for width
assert(
  fileDoesNotContain(
    "components/dashboard/D3Treemap.tsx",
    "Math.max(Math.floor(width), 320)",
  ),
  "D3Treemap.tsx no longer has 320px minimum width constraint",
);

// 3. D3Treemap.tsx: width is now Math.max(Math.floor(width), 0)
assert(
  fileContains("components/dashboard/D3Treemap.tsx", "Math.max(Math.floor(width), 0)"),
  "D3Treemap.tsx uses safe Math.max(Math.floor(width), 0) for width",
);

// 4. D3Treemap.tsx: SVG has max-w-full
assert(
  fileContains("components/dashboard/D3Treemap.tsx", "max-w-full overflow-hidden rounded-lg"),
  "D3Treemap.tsx SVG has max-w-full class",
);

// 5. DashboardPage.tsx: main container has overflow-x-hidden
assert(
  fileContains("components/dashboard/DashboardPage.tsx", "overflow-x-hidden"),
  "DashboardPage.tsx main container has overflow-x-hidden",
);

// 6. KpiCards.tsx: value text is responsive (not fixed text-2xl only)
assert(
  fileContains("components/dashboard/KpiCards.tsx", "sm:text-xl") &&
    fileContains("components/dashboard/KpiCards.tsx", "lg:text-2xl"),
  "KpiCards.tsx values use responsive text sizing (text-lg sm:text-xl lg:text-2xl)",
);

// 7. NetworkTreemap.tsx: treemap container has max-w-full
assert(
  fileContains("components/dashboard/NetworkTreemap.tsx", "max-w-full"),
  "NetworkTreemap.tsx treemap container has max-w-full",
);

// 8. NetworkTreemap.tsx: CardContent has min-w-0
assert(
  fileContains("components/dashboard/NetworkTreemap.tsx", "min-w-0"),
  "NetworkTreemap.tsx CardContent has min-w-0 to allow shrinking",
);

// 9. PeriodSelector.tsx: uses flex-wrap for buttons
assert(
  fileContains("components/dashboard/PeriodSelector.tsx", "flex-wrap"),
  "PeriodSelector.tsx uses flex-wrap for period buttons",
);

// 10. TreemapViewSelector.tsx: uses flex-wrap for view selector
assert(
  fileContains("components/dashboard/TreemapViewSelector.tsx", "flex-wrap"),
  "TreemapViewSelector.tsx uses flex-wrap for view selector buttons",
);

// 11. NetworkTreemap.tsx: legend uses flex-wrap
assert(
  fileContains("components/dashboard/NetworkTreemap.tsx", "flex flex-wrap gap-2"),
  "NetworkTreemap.tsx legend uses flex-wrap",
);

console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} checks\n`);

if (failed > 0) {
  process.exit(1);
}

console.log("🎉 All responsive overflow protections are in place!\n");
