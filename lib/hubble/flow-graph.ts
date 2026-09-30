import type { Period } from "@/lib/types";
import type { FlowGraph } from "@/lib/schemas/flow-graph";
import { buildFlowGraphFixture } from "@/lib/fixtures/flow-graph";

export interface FlowGraphProvider {
  (
    period: Period,
    account?: string,
  ): Promise<FlowGraph>;
}

function hasCredentials(): boolean {
  return Boolean(
    process.env.HUBBLE_DATASET_ID ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT,
  );
}

export async function fetchFlowGraph(
  period: Period,
  account?: string,
): Promise<FlowGraph> {
  if (!hasCredentials()) {
    return buildFlowGraphFixture(period, account);
  }

  // Live edge/counterparty queries are not yet wired into the Hubble adapter;
  // fall back to the fixture graph until they land.
  return buildFlowGraphFixture(period, account);
}
