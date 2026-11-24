import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cloneValidFixture } from "@/lib/schemas/fixtures/valid-activity-response";
import { METHODOLOGY_VERSION } from "@/lib/metrics/methodology";
import {
  buildDashboardMarkdownSnapshot,
  buildMarkdownFromActivity,
  extractCategoriesFromTreemap,
  sortCategoriesForMarkdown,
  sortProtocolsForMarkdown,
} from "./export-markdown";
import type { ActivityKpis, ProtocolSummary, TreemapNode } from "@/lib/types";

const sampleKpis: ActivityKpis = {
  totalOps: { kind: "operations", unit: "ops", value: 100 },
  sorobanShare: { kind: "share", unit: "percent", value: 40 },
  topCategory: "Payments",
  activeContracts: { kind: "entity_count", unit: "count", value: 1 },
  activeWallets: { kind: "entity_count", unit: "count", value: 10 },
  activeDestinationAccounts: { kind: "entity_count", unit: "count", value: 8 },
};

describe("export-markdown", () => {
  test("sortCategoriesForMarkdown is value-desc then name-asc", () => {
    const sorted = sortCategoriesForMarkdown([
      { name: "Beta", value: 10, share: 10 },
      { name: "Alpha", value: 10, share: 10 },
      { name: "Gamma", value: 50, share: 50 },
    ]);
    assert.deepEqual(
      sorted.map((r) => r.name),
      ["Gamma", "Alpha", "Beta"],
    );
  });

  test("sortProtocolsForMarkdown is rank-asc then name", () => {
    const sorted = sortProtocolsForMarkdown([
      { name: "Zebra", opCount: 1, share: 1, rank: 2 },
      { name: "Alpha", opCount: 9, share: 9, rank: 1 },
      { name: "Beta", opCount: 1, share: 1, rank: 2 },
    ]);
    assert.deepEqual(
      sorted.map((r) => r.name),
      ["Alpha", "Beta", "Zebra"],
    );
  });

  test("buildDashboardMarkdownSnapshot is fixture-stable and GitHub-friendly", () => {
    const md = buildDashboardMarkdownSnapshot({
      period: "1d",
      start: "2026-07-28T00:00:00.000Z",
      end: "2026-07-28T23:59:59.999Z",
      kpis: sampleKpis,
      categories: [
        { name: "Soroban Contracts", value: 40, share: 40 },
        { name: "Payments", value: 60, share: 60 },
      ],
      protocols: [
        { name: "Soroswap", opCount: 30, share: 30, rank: 1 },
        { name: "LOBSTR", opCount: 20, share: 20, rank: 2 },
      ],
      methodologyVersion: METHODOLOGY_VERSION,
      permalink: "https://lumenmap.example/?period=1d&metric=ops&view=events",
      source: "fixture",
      generatedAt: "2026-07-29T00:00:00.000Z",
    });

    assert.match(md, /^# LumenMap dashboard snapshot\n/);
    assert.match(md, /\*\*Period:\*\* 1d \(2026-07-28T00:00:00\.000Z → 2026-07-28T23:59:59\.999Z\)/);
    assert.match(
      md,
      /\*\*Permalink:\*\* https:\/\/lumenmap\.example\/\?period=1d&metric=ops&view=events/,
    );
    assert.match(md, new RegExp(`\\*\\*Methodology version:\\*\\* ${METHODOLOGY_VERSION}`));
    assert.match(md, /\| Total operations \| 100 \|/);
    assert.match(md, /\| Top category \| Payments \|/);
    // Stable order: Payments before Soroban
    const paymentsIdx = md.indexOf("**Payments**");
    const sorobanIdx = md.indexOf("**Soroban Contracts**");
    assert.ok(paymentsIdx > 0 && sorobanIdx > paymentsIdx);
    assert.match(md, /1\. \*\*Payments\*\*/);
    assert.match(md, /1\. \*\*Soroswap\*\*/);
    assert.match(md, /2\. \*\*LOBSTR\*\*/);
    // No credential-looking material
    assert.doesNotMatch(md, /private.?key|mnemonic|password|api[_-]?key/i);
    // Clean GitHub paste: blank line after heading, tables use pipes
    assert.match(md, /## KPIs\n\n\| Metric \| Value \|/);
  });

  test("extractCategoriesFromTreemap reads category children", () => {
    const root: TreemapNode = {
      name: "root",
      value: 100,
      children: [
        {
          name: "Payments",
          value: 60,
          meta: { type: "category", share: 60 },
        },
        {
          name: "Other",
          value: 40,
          meta: { type: "category", share: 40 },
        },
      ],
    };
    const rows = extractCategoriesFromTreemap(root);
    assert.equal(rows[0]?.name, "Payments");
    assert.equal(rows[1]?.name, "Other");
  });

  test("buildMarkdownFromActivity uses fixture data and methodology version", () => {
    const data = cloneValidFixture();
    data.protocols = {
      bars: [
        {
          protocol: "Soroswap",
          opCount: 40,
          share: 40,
          rank: 1,
          entityCount: 2,
        },
        {
          protocol: "Aqua",
          opCount: 20,
          share: 20,
          rank: 2,
          entityCount: 1,
        },
      ],
      totalOps: 60,
      labeledOps: 60,
      coverage: 100,
      unknownCount: 0,
    } satisfies ProtocolSummary;

    const md = buildMarkdownFromActivity(
      data,
      "https://example.test/?period=1d",
      { generatedAt: "2026-07-29T12:00:00.000Z" },
    );

    assert.match(md, new RegExp(`Methodology version:\\*\\* ${METHODOLOGY_VERSION}`));
    assert.match(md, /\*\*Permalink:\*\* https:\/\/example\.test\/\?period=1d/);
    assert.match(md, /1\. \*\*Payments\*\*/);
    assert.match(md, /1\. \*\*Soroswap\*\*/);
    assert.equal(
      buildMarkdownFromActivity(data, "https://example.test/?period=1d", {
        generatedAt: "2026-07-29T12:00:00.000Z",
      }),
      md,
    );
  });
});
