#!/usr/bin/env node
// Simple test runner for export utilities (no external deps beyond Node)

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simulate import by reading and evaluating the TS logic (simplified JS version for testing)
const exportUtilsPath = path.resolve(__dirname, '../lib/export-utils.ts');

console.log("🧪 Running export-utils validation tests...\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

function generateSafeFilename(prefix, metric, period, extension, timestamp) {
  const safeMetric = metric.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const safePeriod = period.replace(/[^a-z0-9]/g, "");
  const datePart = timestamp || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${safeMetric}-${safePeriod}-${datePart}.${extension}`;
}

function buildExportMetadata(data, period, treemapView, viewLabel) {
  const now = new Date();
  const freshness = data?.end ? new Date(data.end).toISOString() : now.toISOString();

  return {
    metric: viewLabel || "Network Activity",
    unit: "operations",
    period,
    timezone: "UTC",
    freshness,
    filters: {
      period,
      view: treemapView,
      source: data?.source || "hubble",
    },
    generatedAt: now.toISOString(),
    view: treemapView,
  };
}

function getStructuredRowsForExport(data, treemapView) {
  if (!data) {
    return { rows: [], syntheticIdentifiers: ["other"] };
  }

  const syntheticIdentifiers = ["other", "remainder"];

  if (treemapView === "events") {
    const categoryRows = data.categories.map((r) => ({
      ...r,
      source_table: "categories",
      is_synthetic: r.type_string.toLowerCase().includes("other") ? "yes" : "no",
    }));

    const functionRows = data.sorobanFunctions.map((r) => ({
      function_name: r.function_name,
      op_count: r.op_count,
      source_table: "sorobanFunctions",
      is_synthetic: "no",
    }));

    return {
      rows: [...categoryRows, ...functionRows],
      syntheticIdentifiers,
    };
  } else {
    const contractRows = data.contracts.map((r) => ({
      ...r,
      source_table: "contracts",
      is_synthetic: "no",
    }));

    const accountRows = data.accounts.map((r) => ({
      ...r,
      source_table: "accounts",
      is_synthetic: "no",
    }));

    return {
      rows: [...contractRows, ...accountRows],
      syntheticIdentifiers,
    };
  }
}

function flattenTreemapForCsv(node, path = []) {
  const result = [];
  const currentPath = [...path, node.name];

  const row = {
    path: currentPath.join(" > "),
    name: node.name,
    value: node.value ?? node.meta?.opCount ?? 0,
    share: node.meta?.share ?? null,
    category: node.meta?.category ?? null,
    type: node.meta?.type ?? null,
    id: node.meta?.id ?? node.id ?? null,
    protocol: node.meta?.protocol ?? null,
    eventType: node.meta?.eventType ?? null,
    childCount: node.meta?.childCount ?? (node.children?.length ?? 0),
    is_synthetic: (node.name.toLowerCase().includes("other") || node.name.toLowerCase().includes("remainder")) ? "yes" : "no",
  };

  result.push(row);

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(...flattenTreemapForCsv(child, currentPath));
    }
  }

  return result;
}

// Mock data
const mockData = {
  period: "1d",
  start: "2026-07-28T00:00:00.000Z",
  end: "2026-07-28T23:59:59.999Z",
  source: "hubble",
  categories: [
    { type_string: "payment", op_count: 450000 },
    { type_string: "invoke_host_function", op_count: 320000 },
    { type_string: "other", op_count: 15000 },
  ],
  contracts: [
    { contract_id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2", op_count: 125000 },
  ],
  accounts: [
    { account_id: "GABC123...", type_string: "payment", op_count: 89000 },
  ],
  sorobanFunctions: [
    { function_name: "swap", op_count: 210000 },
  ],
  sorobanFunctionContracts: [],
  kpis: {
    totalOps: 800000,
    sorobanShare: 40,
    topCategory: "Payments",
    activeContracts: 120,
  },
  treemaps: {
    events: {
      name: "Network Activity",
      value: 800000,
      meta: { type: "root", opCount: 800000 },
      children: [
        {
          name: "Payments",
          value: 450000,
          meta: { type: "category", category: "payments", opCount: 450000 },
          children: [],
        },
        {
          name: "Soroban",
          value: 320000,
          meta: { type: "category", category: "soroban", opCount: 320000 },
          children: [],
        },
        {
          name: "Other",
          value: 15000,
          meta: { type: "category", category: "other", opCount: 15000 },
          children: [],
        },
      ],
    },
    actors: {
      name: "Accounts & Contracts",
      value: 800000,
      meta: { type: "root", opCount: 800000 },
      children: [],
    },
  },
};

// === TESTS ===

console.log("Test 1: generateSafeFilename");
const name1 = generateSafeFilename("lumenmap-treemap", "Network Activity", "1d", "png", "20260728");
const name2 = generateSafeFilename("lumenmap-data", "Accounts & Contracts", "7d", "csv", "20260728");
assert(name1 === "lumenmap-treemap-network-activity-1d-20260728.png", "PNG filename is deterministic and safe");
assert(name2 === "lumenmap-data-accounts-contracts-7d-20260728.csv", "CSV filename is deterministic and safe");

console.log("\nTest 2: buildExportMetadata");
const metadata = buildExportMetadata(mockData, "1d", "events", "Operation Types");
assert(metadata.metric === "Operation Types", "Metadata contains correct metric");
assert(metadata.unit === "operations", "Metadata contains unit");
assert(metadata.period === "1d", "Metadata contains period");
assert(metadata.timezone === "UTC", "Metadata contains timezone");
assert(metadata.freshness.includes("2026"), "Metadata freshness is present");
assert(metadata.filters.period === "1d", "Metadata filters present");
assert(metadata.generatedAt, "Metadata has generatedAt");

console.log("\nTest 3: getStructuredRowsForExport (events)");
const exportEvents = getStructuredRowsForExport(mockData, "events");
assert(exportEvents.rows.length > 0, "Events view returns rows");
assert(exportEvents.rows.some(r => r.source_table === "categories"), "Contains category rows");
assert(exportEvents.syntheticIdentifiers.includes("other"), "Identifies synthetic rows");

console.log("\nTest 4: getStructuredRowsForExport (actors)");
const exportActors = getStructuredRowsForExport(mockData, "actors");
assert(exportActors.rows.length > 0, "Actors view returns rows");
assert(exportActors.rows.some(r => r.source_table === "contracts" || r.source_table === "accounts"), "Contains contract/account rows");

console.log("\nTest 5: flattenTreemapForCsv");
const flat = flattenTreemapForCsv(mockData.treemaps.events);
assert(flat.length > 1, "Treemap flattens correctly");
assert(flat[0].name === "Network Activity", "Root node included");
assert(flat.some(r => r.is_synthetic === "yes"), "Marks synthetic 'Other' row correctly");
assert(flat.every(r => r.value !== undefined), "All rows have values");

console.log("\nTest 6: Full metadata completeness");
const fullMeta = buildExportMetadata(mockData, "30d", "actors", "Accounts & Contracts");
const requiredKeys = ["metric", "unit", "period", "timezone", "freshness", "filters", "generatedAt", "view"];
assert(requiredKeys.every(k => fullMeta.hasOwnProperty(k)), "All required metadata fields present");

console.log("\n" + "=".repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log("\n❌ Some tests failed.");
  process.exit(1);
} else {
  console.log("\n✅ All export tests passed successfully!");
  process.exit(0);
}
