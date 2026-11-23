import { getBigQueryClient } from "@/lib/hubble/client";
import { getMaxBytesBilledLimit } from "@/lib/hubble/config";
import { resolveDataSource } from "@/lib/data-source";
import { resolveHubbleDataset, type DashboardNetworkId } from "@/lib/network";
import { resolvePeriod } from "@/lib/periods";
import type { Period } from "@/lib/types";
import { FIXTURE_FLOW_EDGES } from "./fixtures";
import { buildFlowGraph, type FlowEdge, type FlowGraph } from "./graph";
import { FLOW_MAX_EDGES } from "./limits";

export interface FlowResponse extends FlowGraph {
  period: Period;
  account: string | null;
  source: "fixture" | "hubble";
  sampled: boolean;
}

// The account predicate applies before ranking: an ego request cannot be
// derived from the sampled period overview without losing small counterparties.
export function flowQuery(dataset: string, ego: boolean): string {
  if (!/^[\w-]+\.[\w-]+$/.test(dataset)) {
    throw new Error("Invalid Hubble dataset configuration");
  }
  return `
WITH transfers AS (
  SELECT
    type_string,
    op_source_account AS source,
    CASE type_string
      WHEN 'create_account' THEN details.new_account
      WHEN 'account_merge' THEN details.into
      ELSE details.to
    END AS destination,
    CASE WHEN type_string IN ('create_account', 'account_merge') THEN 'native'
      WHEN type_string = 'path_payment_strict_send'
      THEN source_asset_type ELSE asset_type END AS asset_type,
    CASE WHEN type_string = 'path_payment_strict_send'
      THEN source_asset_code ELSE asset_code END AS asset_code,
    CASE WHEN type_string = 'path_payment_strict_send'
      THEN source_asset_issuer ELSE asset_issuer END AS asset_issuer,
    CASE WHEN type_string IN ('create_account', 'account_merge') THEN 0
      WHEN type_string = 'path_payment_strict_send' THEN source_amount
      ELSE amount END AS amount
  FROM \`${dataset}.enriched_history_operations\`
  WHERE @start <= closed_at AND closed_at < @end
    AND type_string IN ('payment', 'path_payment_strict_send',
      'path_payment_strict_receive', 'create_account', 'account_merge')
), valid AS (
  SELECT * FROM transfers
  WHERE source IS NOT NULL AND STARTS_WITH(source, 'G')
    AND destination IS NOT NULL AND STARTS_WITH(destination, 'G')
    AND source != destination
    AND (asset_type = 'native' OR
      (asset_code IS NOT NULL AND asset_issuer IS NOT NULL))
    ${ego ? "AND (source = @account OR destination = @account)" : ""}
), ranked AS (
  SELECT source, destination, asset_type, asset_code, asset_issuer,
    CAST(ROUND(SUM(IF(amount IS NULL OR amount < 0 OR IS_INF(amount) OR IS_NAN(amount), 0, amount)) * 10000000) AS STRING) AS amount,
    COUNTIF(type_string IN ('payment', 'path_payment_strict_send', 'path_payment_strict_receive')
      AND amount IS NOT NULL AND amount >= 0 AND NOT IS_INF(amount) AND NOT IS_NAN(amount)) = COUNT(*) AS amount_complete,
    COUNT(*) AS operation_count
  FROM valid
  GROUP BY source, destination, asset_type, asset_code, asset_issuer
)
SELECT *, COUNT(*) OVER () AS total_edges
FROM ranked
ORDER BY operation_count DESC, SAFE_CAST(amount AS BIGNUMERIC) DESC,
  source, destination, asset_type, asset_code, asset_issuer
LIMIT ${FLOW_MAX_EDGES}
`;
}

interface FlowRow {
  source: string;
  destination: string;
  asset_type: string;
  asset_code: string | null;
  asset_issuer: string | null;
  amount: string;
  amount_complete: boolean;
  operation_count: number;
  total_edges: number;
}

function mapRow(row: FlowRow): FlowEdge {
  const assetKey = row.asset_type === "native"
    ? "native:XLM"
    : `${row.asset_code}:${row.asset_issuer}`;
  return {
    id: `${row.source}->${row.destination}|${assetKey}`,
    source: row.source,
    destination: row.destination,
    assetKey,
    asset: { code: row.asset_type === "native" ? "XLM" : row.asset_code ?? "" },
    amount: String(row.amount),
    amountComplete: row.amount_complete,
    operationCount: Number(row.operation_count),
  };
}

export async function getFlowData(
  period: Period,
  network: DashboardNetworkId,
  account: string | null,
): Promise<FlowResponse> {
  const mode = resolveDataSource();
  if (mode === "fixture") {
    return {
      period,
      account,
      source: "fixture",
      sampled: false,
      ...buildFlowGraph(FIXTURE_FLOW_EDGES, account ?? undefined),
    };
  }

  const client = getBigQueryClient();
  if (!client) throw new Error("BigQuery client is not configured");
  const dataset = resolveHubbleDataset(network);
  const range = resolvePeriod(period);
  const [job] = await client.createQueryJob({
    query: flowQuery(dataset, account !== null),
    params: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      ...(account ? { account } : {}),
    },
    maximumBytesBilled: getMaxBytesBilledLimit().toString(),
  });
  const [rows] = await job.getQueryResults();
  const typedRows = rows as FlowRow[];
  return {
    period,
    account,
    source: "hubble",
    sampled: Number(typedRows[0]?.total_edges ?? 0) > FLOW_MAX_EDGES,
    ...buildFlowGraph(typedRows.map(mapRow), account ?? undefined),
  };
}
