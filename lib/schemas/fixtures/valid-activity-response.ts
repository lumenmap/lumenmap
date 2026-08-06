import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type { ActivityResponse } from "../activity-response";

/** Representative valid visualization response for schema tests. */
export const validActivityResponseFixture: ActivityResponse = {
  period: "1d",
  start: "2026-07-28T00:00:00.000Z",
  end: "2026-07-28T23:59:59.999Z",
  source: "hubble",
  sourceTimestamp: "2026-07-29T00:00:00.000Z",
  isPeriodComplete: true,
  kpis: {
    totalOps: { kind: "operations", unit: "ops", value: 100 },
    sorobanShare: { kind: "share", unit: "percent", value: 40 },
    topCategory: "Payments",
    activeContracts: { kind: "entity_count", unit: "count", value: 1 },
  },
  treemaps: {
    events: {
      name: "Network Activity",
      metric: "operation_count",
      unit: { kind: "count", subject: "operation" },
      value: 100,
      meta: { type: "root", opCount: 100 },
      children: [
        {
          name: "Payments",
          value: 60,
          meta: {
            type: "category",
            category: "payments",
            opCount: 60,
            share: 60,
            childCount: 1,
          },
          children: [
            {
              name: "payment",
              value: 60,
              meta: {
                type: "entity",
                category: "payments",
                opCount: 60,
                eventType: "payment",
              },
            },
          ],
        },
        {
          name: "Soroban Contracts",
          value: 40,
          meta: {
            type: "category",
            category: "soroban",
            opCount: 40,
            share: 40,
            childCount: 1,
          },
          children: [
            {
              name: "transfer",
              value: 40,
              meta: {
                type: "entity",
                category: "soroban",
                opCount: 40,
                eventType: "transfer",
              },
            },
          ],
        },
      ],
    },
    actors: {
      name: "Network Activity",
      metric: "operation_count",
      unit: { kind: "count", subject: "operation" },
      value: 100,
      meta: { type: "root", opCount: 100 },
      children: [
        {
          name: "Payments",
          value: 60,
          color: "#14B8A6",
          meta: {
            type: "category",
            category: "payments",
            opCount: 60,
            share: 60,
            childCount: 1,
          },
          children: [
            {
              id: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF",
              name: "Example Wallet",
              value: 60,
              meta: {
                type: "account",
                id: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF",
                category: "payments",
                opCount: 60,
              },
            },
          ],
        },
      ],
    },
    xlm_events: {
      name: "Network Activity",
      metric: "asset_volume",
      unit: { kind: "asset", asset: { type: "native", code: "XLM" } },
      value: "12.5",
      meta: { type: "root", xlmVolume: 12.5 },
      children: [
        {
          name: "Payments",
          value: "12.5",
          meta: {
            type: "category",
            category: "payments",
            xlmVolume: 12.5,
            share: 100,
            childCount: 1,
          },
          children: [
            {
              name: "payment",
              value: "12.5",
              meta: {
                type: "entity",
                category: "payments",
                xlmVolume: 12.5,
                eventType: "payment",
              },
            },
          ],
        },
      ],
    },
    xlm_actors: {
      name: "Network Activity",
      metric: "asset_volume",
      unit: { kind: "asset", asset: { type: "native", code: "XLM" } },
      value: "12.5",
      meta: { type: "root", xlmVolume: 12.5 },
      children: [
        {
          name: "Payments",
          value: "12.5",
          meta: {
            type: "category",
            category: "payments",
            xlmVolume: 12.5,
            share: 100,
            childCount: 1,
          },
          children: [
            {
              id: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF",
              name: "Example Wallet",
              value: "12.5",
              meta: {
                type: "account",
                id: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF",
                category: "payments",
                xlmVolume: 12.5,
              },
            },
          ],
        },
      ],
    },
    usdc_events: {
      name: "Network USDC Activity",
      metric: "asset_volume",
      unit: {
        kind: "asset",
        asset: {
          type: "issued",
          code: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
      },
      value: "100.5",
      meta: { type: "root", usdcVolume: 100.5 },
      children: [],
    },
    usdc_actors: {
      name: "Network USDC Activity",
      metric: "asset_volume",
      unit: {
        kind: "asset",
        asset: {
          type: "issued",
          code: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
      },
      value: "100.5",
      meta: { type: "root", usdcVolume: 100.5 },
      children: [],
    },
    txn_events: {
      name: "Network Activity",
      value: 10,
      metric: "transaction_count",
      unit: { kind: "count", subject: "transaction" },
      meta: { type: "root", opCount: 10 },
      children: [
        {
        name: "Payments",
        value: 10,
        meta: { type: "category", category: "payments", opCount: 10 },
        },
      ],
    },
    txn_actors: {
      name: "Network Activity",
      value: 10,
      metric: "transaction_count",
      unit: { kind: "count", subject: "transaction" },
      meta: { type: "root", opCount: 10 },
      children: [
        {
        name: "Payments",
        value: 10,
        meta: { type: "category", category: "payments", opCount: 10 },
        },
      ],
    },
  },
  metricProvenance: buildActivityMetricProvenance(),
};

export function cloneValidFixture(): ActivityResponse {
  return structuredClone(validActivityResponseFixture);
}
