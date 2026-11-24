import { getMockEmptyActivity, getMockLoadedActivity } from "@/lib/hubble/fixtures";
import { buildFixtureFlowGraph } from "@/lib/hubble/fixture";
import type { FlowResponse } from "@/lib/flow/data";
import type { SelectedNode, TreemapNode } from "@/lib/types";

export const ACCOUNT_ID = `G${"A".repeat(55)}`;
export const CONTRACT_ID = `C${"A".repeat(55)}`;

export const accountNode: SelectedNode = {
  name: "Example account",
  value: 48_210,
  share: 0.124,
  meta: { type: "account", id: ACCOUNT_ID, category: "payments" },
};

export const contractNode: SelectedNode = {
  name: "Example swap contract",
  value: 126_400,
  share: 0.32,
  meta: {
    type: "contract",
    id: CONTRACT_ID,
    category: "soroban",
    protocol: "Example DEX",
    childCount: 4,
  },
};

export const emptyActivity = {
  ...getMockEmptyActivity(),
  sourceTimestamp: new Date().toISOString(),
};

function flowEntity(
  id: string,
  name: string,
  category: string,
  value: number,
): TreemapNode {
  return { name, value, meta: { type: "entity", id, category, opCount: value } };
}

/** Loaded activity whose events treemap carries entity ids, as `FlowView` expects. */
export const flowActivity = (() => {
  const data = getMockLoadedActivity();
  return {
    ...data,
    treemaps: {
      ...data.treemaps,
      events: {
        ...data.treemaps.events,
        children: [
          {
            name: "Payments",
            value: 300,
            meta: { type: "category", category: "payments" },
            children: [
              flowEntity("GAPAYMENTS1", "Payments wallet A", "payments", 100),
              flowEntity("GAPAYMENTS2", "Payments wallet B", "payments", 120),
              flowEntity("GAPAYMENTS3", "Payments wallet C", "payments", 80),
            ],
          },
          {
            name: "Soroban",
            value: 260,
            meta: { type: "category", category: "soroban" },
            children: [
              flowEntity("CASOROBAN1", "Swap contract", "soroban", 150),
              flowEntity("CASOROBAN2", "Lending contract", "soroban", 110),
            ],
          },
        ],
      },
    },
  };
})();

export const flowResponse: FlowResponse = {
  period: "1d",
  account: null,
  source: "fixture",
  sampled: false,
  ...buildFixtureFlowGraph(),
};

export function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** A request that never settles, to hold a component in its loading state. */
export const pendingFetch = () => new Promise<Response>(() => undefined);
