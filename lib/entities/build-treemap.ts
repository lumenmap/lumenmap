import {
  CATEGORY_COLORS,
  GROUP_LABELS,
  TOP_ACCOUNTS_PER_TYPE,
  TOP_CONTRACTS_PER_FUNCTION,
  TOP_CONTRACT_LIMIT,
  TYPE_TO_GROUP,
} from "@/lib/constants";
import { getDisplayName, lookupEntity } from "@/lib/entities/registry";
import type {
  AccountRow,
  ActiveSourceAccountsRow,
  ActivityKpis,
  ActivityTreemaps,
  CategoryRow,
  ContractRow,
  EntityInfo,
  SorobanFunctionContractRow,
  SorobanFunctionRow,
  TransactionCategoryRow,
  TreemapCoverage,
  TreemapNode,
  UsdcAccountRow,
  UsdcCategoryRow,
  ProtocolBar,
  ProtocolSummary,
} from "@/lib/types";
import {
  OPERATION_COUNT_UNIT,
  TRANSACTION_COUNT_UNIT,
  USDC_ASSET_UNIT,
  XLM_ASSET_UNIT,
} from "@/lib/types";
import { buildProtocolTvlTreemap } from "@/lib/tvl/build-protocol-treemap";
import { PROTOCOL_TVL_FIXTURE_RESULTS } from "@/lib/tvl/protocol-registry";
import type { TvlAdapterResult } from "@/lib/tvl/adapter";

type BuildMetricId = "ops" | "xlm_volume";

interface BuildTreemapInput {
  categories: CategoryRow[];
  transactionCategories?: TransactionCategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  destinationAccounts?: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  usdcCategories?: UsdcCategoryRow[];
  usdcAccounts?: UsdcAccountRow[];
  labels?: Record<string, EntityInfo>;
}

const GROUP_ORDER = [
  "soroban",
  "payments",
  "dex",
  "trustlines",
  "account",
  "other",
] as const;

function getGroupForType(type: string): string {
  return TYPE_TO_GROUP[type] ?? "other";
}

function getGroupTotals(categories: CategoryRow[], metric: BuildMetricId): Map<string, number> {
  const totals = new Map<string, number>();

  for (const row of categories) {
    const group = getGroupForType(row.type_string);
    const value = metric === "xlm_volume" ? (row.xlm_volume ?? 0) : row.op_count;
    totals.set(group, (totals.get(group) ?? 0) + value);
  }

  return totals;
}

function buildContractLeaves(
  contracts: ContractRow[],
  labels?: BuildTreemapInput["labels"],
  metric: BuildMetricId = "ops",
): TreemapNode[] {
  if (metric === "xlm_volume") return []; // No XLM volume for contracts

  return [...contracts]
    .sort((a, b) => b.op_count - a.op_count)
    .map((row) => {
      const entity = lookupEntity(row.contract_id, labels);
      return {
        id: row.contract_id,
        name: entity?.name ?? getDisplayName(row.contract_id, labels),
        value: row.op_count,
        color: CATEGORY_COLORS.soroban,
        meta: {
          type: "contract",
          id: row.contract_id,
          category: "soroban",
          protocol: entity?.protocol,
          opCount: row.op_count,
        },
      };
    });
}

function buildAccountLeavesFromRows(
  rows: { account_id: string; value: number; op_count: number; xlm_volume?: number }[],
  group: string,
  labels?: BuildTreemapInput["labels"],
): TreemapNode[] {
  const color = CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other;

  return [...rows]
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((row) => {
      const entity = lookupEntity(row.account_id, labels);
      return {
        id: row.account_id,
        name: entity?.name ?? getDisplayName(row.account_id, labels),
        value: row.value,
        color,
        meta: {
          type: "account",
          id: row.account_id,
          category: group,
          protocol: entity?.protocol,
          opCount: row.op_count,
          xlmVolume: row.xlm_volume,
        },
      };
    });
}

function buildAccountLeaves(
  accounts: AccountRow[],
  group: string,
  labels?: BuildTreemapInput["labels"],
  metric: BuildMetricId = "ops",
): TreemapNode[] {
  const filtered = accounts.filter(
    (row) => getGroupForType(row.type_string) === group,
  );

  const byAccount = new Map<string, { op_count: number; xlm_volume: number }>();
  for (const row of filtered) {
    const existing = byAccount.get(row.account_id) ?? { op_count: 0, xlm_volume: 0 };
    byAccount.set(row.account_id, {
      op_count: existing.op_count + row.op_count,
      xlm_volume: existing.xlm_volume + (row.xlm_volume ?? 0),
    });
  }

  const rows = [...byAccount.entries()].map(([account_id, data]) => ({
    account_id,
    op_count: data.op_count,
    xlm_volume: data.xlm_volume,
    value: metric === "xlm_volume" ? data.xlm_volume : data.op_count,
  }));

  return buildAccountLeavesFromRows(rows, group, labels);
}

function buildAccountLeavesForEventType(
  accounts: AccountRow[],
  eventType: string,
  group: string,
  labels?: BuildTreemapInput["labels"],
  metric: BuildMetricId = "ops",
): TreemapNode[] {
  const rows = accounts
    .filter((row) => row.type_string === eventType)
    .map((row) => ({
      account_id: row.account_id,
      op_count: row.op_count,
      xlm_volume: row.xlm_volume,
      value: metric === "xlm_volume" ? (row.xlm_volume ?? 0) : row.op_count,
    }));

  if (rows.length === 0) {
    return [];
  }

  return buildAccountLeavesFromRows(rows, group, labels);
}

function buildContractLeavesForFunction(
  rows: SorobanFunctionContractRow[],
  functionName: string,
  labels?: BuildTreemapInput["labels"],
  metric: BuildMetricId = "ops",
): TreemapNode[] {
  if (metric === "xlm_volume") return []; // Soroban doesn't have XLM volume mapped here

  return buildContractLeaves(
    rows
      .filter((row) => row.function_name === functionName)
      .map((row) => ({
        contract_id: row.contract_id,
        op_count: row.op_count,
      })),
    labels,
    metric
  );
}

/**
 * Build coverage metadata for a capped treemap parent node.
 * The synthetic remainder node is excluded from the named-child calculation.
 *
 * @param children - The named child nodes (remainder excluded).
 * @param parentValue - The parent node's total value.
 * @param configuredLimit - The configured top-N limit.
 * @param namedChildValue - Optional pre-calculated sum of child values.
 * @returns Coverage metadata, or undefined when there are no children.
 */
export function buildCoverage(
  children: TreemapNode[],
  parentValue: number,
  configuredLimit: number,
  namedChildValue?: number,
): TreemapCoverage | undefined {
  // Only calculate when there are capped children
  if (children.length === 0) {
    return undefined;
  }

  const childValue =
    namedChildValue ??
    children.reduce((sum, child) => sum + (child.value ?? child.meta?.opCount ?? 0), 0);

  // Zero-value parent: explicit non-NaN rule
  if (parentValue === 0) {
    return {
      namedChildValue: 0,
      parentValue: 0,
      coveragePercent: 0,
      namedEntityCount: children.length,
      configuredLimit,
    };
  }

  return {
    namedChildValue: childValue,
    parentValue,
    coveragePercent: (childValue / parentValue) * 100,
    namedEntityCount: children.length,
    configuredLimit,
  };
}

function buildSorobanFunctionLeaves(input: BuildTreemapInput, metric: BuildMetricId = "ops"): TreemapNode[] {
  if (metric === "xlm_volume") return []; // No XLM volume for Soroban functions here

  const color = CATEGORY_COLORS.soroban;

  return [...input.sorobanFunctions]
    .sort((a, b) => b.op_count - a.op_count)
    .map((row) => {
      const contractChildren = buildContractLeavesForFunction(
        input.sorobanFunctionContracts,
        row.function_name,
        input.labels,
        metric,
      );

      const coverage =
        contractChildren.length > 0
          ? buildCoverage(
              contractChildren,
              row.op_count,
              TOP_CONTRACTS_PER_FUNCTION,
            )
          : undefined;

      return {
        name: row.function_name.replaceAll("_", " "),
        value: row.op_count,
        color,
        ...(contractChildren.length > 0 ? { children: contractChildren } : {}),
        meta: {
          type: "entity" as const,
          category: "soroban",
          opCount: row.op_count,
          eventType: row.function_name,
          childCount: contractChildren.length || undefined,
          coverage,
        },
      };
    });
}

function buildTypeLeaves(
  input: BuildTreemapInput,
  group: string,
  metric: BuildMetricId = "ops",
): TreemapNode[] {
  if (group === "soroban") {
    return buildSorobanFunctionLeaves(input, metric);
  }

  const color = CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other;

  return input.categories
    .filter((row) => getGroupForType(row.type_string) === group)
    .map((row) => ({
      ...row,
      value: metric === "xlm_volume" ? (row.xlm_volume ?? 0) : row.op_count,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((row) => {
      const accountChildren = buildAccountLeavesForEventType(
        input.accounts,
        row.type_string,
        group,
        input.labels,
        metric,
      );

      const coverage =
        accountChildren.length > 0
          ? buildCoverage(
              accountChildren,
              row.op_count,
              TOP_ACCOUNTS_PER_TYPE,
            )
          : undefined;

      return {
        name: row.type_string.replaceAll("_", " "),
        value: row.value,
        color,
        ...(accountChildren.length > 0 ? { children: accountChildren } : {}),
        meta: {
          type: "entity" as const,
          category: group,
          opCount: row.op_count,
          xlmVolume: row.xlm_volume,
          eventType: row.type_string,
          childCount: accountChildren.length || undefined,
          coverage,
        },
      };
    });
}

function buildCategoryGroupChildren(
  group: string,
  input: BuildTreemapInput,
  metric: BuildMetricId = "ops",
): TreemapNode[] {
  if (group === "soroban") {
    return buildContractLeaves(input.contracts, input.labels, metric);
  }

  if (group === "payments" || group === "dex" || group === "trustlines") {
    const accountLeaves = buildAccountLeaves(
      input.accounts,
      group,
      input.labels,
      metric,
    );
    if (accountLeaves.length > 0) {
      return accountLeaves;
    }
  }

  return buildTypeLeaves(input, group, metric);
}

function buildGroupCoverage(
  group: string,
  value: number,
  children: TreemapNode[],
): TreemapCoverage | undefined {
  if (children.length === 0) {
    return undefined;
  }

  // Determine the applicable top-N limit for this group
  let configuredLimit: number | null = null;
  if (group === "soroban") {
    // Soroban contracts are capped at TOP_CONTRACT_LIMIT
    configuredLimit = TOP_CONTRACT_LIMIT;
  } else if (
    group === "payments" ||
    group === "dex" ||
    group === "trustlines"
  ) {
    // Accounts per type are capped at TOP_ACCOUNTS_PER_TYPE
    configuredLimit = TOP_ACCOUNTS_PER_TYPE;
  }

  if (configuredLimit === null) {
    return undefined;
  }

  return buildCoverage(children, value, configuredLimit);
}

function buildGroupedTreemap(
  input: BuildTreemapInput,
  metric: BuildMetricId,
  getCategoryChildren: (group: string, metric: BuildMetricId) => TreemapNode[],
): TreemapNode {
  const groupTotals = getGroupTotals(input.categories, metric);
  const totalOps = categoriesTotal(input.categories, metric);

  const children: TreemapNode[] = GROUP_ORDER.flatMap((group) => {
    const value = groupTotals.get(group) ?? 0;
    if (value <= 0) {
      return [];
    }

    const categoryChildren = getCategoryChildren(group, metric);
    const coverage = buildGroupCoverage(group, value, categoryChildren);

    return [
      {
        name: GROUP_LABELS[group] ?? group,
        value,
        color: CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other,
        meta: {
          type: "category",
          category: group,
          opCount: metric === "ops" ? value : undefined,
          xlmVolume: metric === "xlm_volume" ? value : undefined,
          share: totalOps > 0 ? (value / totalOps) * 100 : 0,
          childCount: categoryChildren.length,
          coverage,
        },
        children: categoryChildren,
      },
    ];
  });

  return {
    name: "Network Activity",
    value: totalOps,
    meta: {
      type: "root",
      opCount: metric === "ops" ? totalOps : undefined,
      xlmVolume: metric === "xlm_volume" ? totalOps : undefined,
    },
    children,
  };
}

export function buildEventTypeTreemap(input: BuildTreemapInput, metric: BuildMetricId = "ops"): TreemapNode {
  return buildGroupedTreemap(input, metric, (group, m) => buildTypeLeaves(input, group, m));
}

export function buildActorTreemap(input: BuildTreemapInput, metric: BuildMetricId = "ops"): TreemapNode {
  return buildGroupedTreemap(input, metric, (group, m) =>
    buildCategoryGroupChildren(group, input, m),
  );
}

function serializeAssetValues(node: TreemapNode): TreemapNode<string> {
  const { value, children, ...rest } = node;
  return {
    ...rest,
    ...(value !== undefined ? { value: String(value) } : {}),
    ...(children
      ? { children: children.map(serializeAssetValues) }
      : {}),
  };
}

function buildUsdcAccountLeavesFromRows(
  rows: { account_id: string; amount: number }[],
  group: string,
  labels?: BuildTreemapInput["labels"],
): TreemapNode[] {
  const color = CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other;
  return [...rows]
    .sort((a, b) => b.amount - a.amount)
    .map((row) => {
      const entity = lookupEntity(row.account_id, labels);
      return {
        id: row.account_id,
        name: entity?.name ?? getDisplayName(row.account_id, labels),
        value: row.amount,
        color,
        meta: {
          type: "account" as const,
          id: row.account_id,
          category: group,
          protocol: entity?.protocol,
          usdcVolume: row.amount,
        },
      };
    });
}

function buildUsdcAccountLeaves(
  usdcAccounts: UsdcAccountRow[],
  group: string,
  labels?: BuildTreemapInput["labels"],
): TreemapNode[] {
  const filtered = usdcAccounts.filter(
    (row) => getGroupForType(row.type_string) === group,
  );

  const byAccount = new Map<string, number>();
  for (const row of filtered) {
    byAccount.set(
      row.account_id,
      (byAccount.get(row.account_id) ?? 0) + row.amount,
    );
  }

  const rows = [...byAccount.entries()].map(([account_id, amount]) => ({
    account_id,
    amount,
  }));

  return buildUsdcAccountLeavesFromRows(rows, group, labels);
}

function buildUsdcAccountLeavesForEventType(
  usdcAccounts: UsdcAccountRow[],
  eventType: string,
  group: string,
  labels?: BuildTreemapInput["labels"],
): TreemapNode[] {
  const rows = usdcAccounts
    .filter((row) => row.type_string === eventType)
    .map((row) => ({
      account_id: row.account_id,
      amount: row.amount,
    }));

  if (rows.length === 0) {
    return [];
  }

  return buildUsdcAccountLeavesFromRows(rows, group, labels);
}

export function buildUsdcEventTypeTreemap(input: BuildTreemapInput): TreemapNode {
  const usdcCategories = input.usdcCategories ?? [];
  const usdcAccounts = input.usdcAccounts ?? [];
  const totalUsdc = usdcCategories.reduce((sum, row) => sum + row.amount, 0);

  const groupTotals = new Map<string, number>();
  for (const row of usdcCategories) {
    const group = getGroupForType(row.type_string);
    groupTotals.set(group, (groupTotals.get(group) ?? 0) + row.amount);
  }

  const children: TreemapNode[] = GROUP_ORDER.flatMap((group) => {
    const value = groupTotals.get(group) ?? 0;
    if (value <= 0) {
      return [];
    }

    const typeLeaves = usdcCategories
      .filter((row) => getGroupForType(row.type_string) === group)
      .sort((a, b) => b.amount - a.amount)
      .map((row) => {
        const accountChildren = buildUsdcAccountLeavesForEventType(
          usdcAccounts,
          row.type_string,
          group,
          input.labels,
        );

        return {
          name: row.type_string.replaceAll("_", " "),
          value: row.amount,
          color: CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other,
          ...(accountChildren.length > 0 ? { children: accountChildren } : {}),
          meta: {
            type: "entity" as const,
            category: group,
            usdcVolume: row.amount,
            eventType: row.type_string,
            childCount: accountChildren.length || undefined,
          },
        };
      });

    return [
      {
        name: GROUP_LABELS[group] ?? group,
        value,
        color: CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other,
        meta: {
          type: "category" as const,
          category: group,
          usdcVolume: value,
          share: totalUsdc > 0 ? (value / totalUsdc) * 100 : 0,
          childCount: typeLeaves.length,
        },
        children: typeLeaves,
      },
    ];
  });

  return {
    name: "Network USDC Activity",
    value: totalUsdc,
    meta: {
      type: "root",
      usdcVolume: totalUsdc,
    },
    children,
  };
}

export function buildUsdcActorTreemap(input: BuildTreemapInput): TreemapNode {
  const usdcCategories = input.usdcCategories ?? [];
  const usdcAccounts = input.usdcAccounts ?? [];
  const totalUsdc = usdcCategories.reduce((sum, row) => sum + row.amount, 0);

  const groupTotals = new Map<string, number>();
  for (const row of usdcCategories) {
    const group = getGroupForType(row.type_string);
    groupTotals.set(group, (groupTotals.get(group) ?? 0) + row.amount);
  }

  const children: TreemapNode[] = GROUP_ORDER.flatMap((group) => {
    const value = groupTotals.get(group) ?? 0;
    if (value <= 0) {
      return [];
    }

    const accountLeaves = buildUsdcAccountLeaves(usdcAccounts, group, input.labels);

    return [
      {
        name: GROUP_LABELS[group] ?? group,
        value,
        color: CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other,
        meta: {
          type: "category" as const,
          category: group,
          usdcVolume: value,
          share: totalUsdc > 0 ? (value / totalUsdc) * 100 : 0,
          childCount: accountLeaves.length,
        },
        children: accountLeaves,
      },
    ];
  });

  return {
    name: "Network USDC Activity",
    value: totalUsdc,
    meta: {
      type: "root",
      usdcVolume: totalUsdc,
    },
    children,
  };
}

function buildTransactionTypeLeaves(
  input: BuildTreemapInput,
  group: string,
): TreemapNode[] {
  const color = CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other;

  return (input.transactionCategories ?? [])
    .filter((row) => getGroupForType(row.type_string) === group)
    .filter((row) => row.txn_count > 0)
    .sort((a, b) => b.txn_count - a.txn_count)
    .map((row) => ({
      name: row.type_string.replaceAll("_", " "),
      value: row.txn_count,
      color,
      meta: {
        type: "entity" as const,
        category: group,
        txnCount: row.txn_count,
        eventType: row.type_string,
      },
    }));
}

export function buildTransactionTreemap(input: BuildTreemapInput): TreemapNode {
  const transactionCategories = input.transactionCategories ?? [];
  const totalTxns = transactionCategories.reduce(
    (sum, row) => sum + row.txn_count,
    0,
  );

  const groupTotals = new Map<string, number>();
  for (const row of transactionCategories) {
    const group = getGroupForType(row.type_string);
    groupTotals.set(group, (groupTotals.get(group) ?? 0) + row.txn_count);
  }

  const children: TreemapNode[] = GROUP_ORDER.flatMap((group) => {
    const value = groupTotals.get(group) ?? 0;
    if (value <= 0) {
      return [];
    }

    const typeLeaves = buildTransactionTypeLeaves(input, group);

    return [
      {
        name: GROUP_LABELS[group] ?? group,
        value,
        color: CATEGORY_COLORS[group] ?? CATEGORY_COLORS.other,
        meta: {
          type: "category" as const,
          category: group,
          txnCount: value,
          share: totalTxns > 0 ? (value / totalTxns) * 100 : 0,
          childCount: typeLeaves.length,
        },
        children: typeLeaves,
      },
    ];
  });

  return {
    name: "Network Activity",
    value: totalTxns,
    meta: {
      type: "root",
      txnCount: totalTxns,
    },
    children,
  };
}

export function buildAllTreemaps(
  input: BuildTreemapInput,
  protocolTvlResults: TvlAdapterResult[] = PROTOCOL_TVL_FIXTURE_RESULTS,
): ActivityTreemaps {
  const eventOperations = buildEventTypeTreemap(input, "ops");
  const actorOperations = buildActorTreemap(input, "ops");
  const actorDestOperations = input.destinationAccounts
    ? buildActorTreemap({ ...input, accounts: input.destinationAccounts }, "ops")
    : { name: "Network Activity", value: 0, meta: { type: "root", opCount: 0 }, children: [] };
  const eventTransaction = buildTransactionTreemap(input);
  const actorTransaction: TreemapNode = {
    name: "Network Activity",
    value: 0,
    meta: {
      type: "root",
      txnCount: 0,
    },
    children: [],
  };
  const eventXlmVolume = serializeAssetValues(
    buildEventTypeTreemap(input, "xlm_volume"),
  );
  const actorXlmVolume = serializeAssetValues(
    buildActorTreemap(input, "xlm_volume"),
  );
  const actorDestXlmVolume = input.destinationAccounts
    ? serializeAssetValues(buildActorTreemap({ ...input, accounts: input.destinationAccounts }, "xlm_volume"))
    : serializeAssetValues({ name: "Network Activity", value: 0, meta: { type: "root", xlmVolume: 0 }, children: [] });
  const eventUsdcVolume = serializeAssetValues(buildUsdcEventTypeTreemap(input));
  const actorUsdcVolume = serializeAssetValues(buildUsdcActorTreemap(input));
  const actorDestUsdcVolume = serializeAssetValues({ name: "Network USDC Activity", value: 0, meta: { type: "root", usdcVolume: 0 }, children: [] });

  return {
    events: {
      ...eventOperations,
      metric: "operation_count",
      unit: OPERATION_COUNT_UNIT,
    },
    actors: {
      ...actorOperations,
      metric: "operation_count",
      unit: OPERATION_COUNT_UNIT,
    },
    actors_dest: {
      ...actorDestOperations,
      metric: "operation_count",
      unit: OPERATION_COUNT_UNIT,
    },
    txn_events: {
      ...eventTransaction,
      metric: "transaction_count",
      unit: TRANSACTION_COUNT_UNIT,
    },
    txn_actors: {
      ...actorTransaction,
      metric: "transaction_count",
      unit: TRANSACTION_COUNT_UNIT,
    },
    txn_actors_dest: {
      ...actorTransaction,
      metric: "transaction_count",
      unit: TRANSACTION_COUNT_UNIT,
    },
    xlm_events: {
      ...eventXlmVolume,
      metric: "asset_volume",
      unit: XLM_ASSET_UNIT,
    },
    xlm_actors: {
      ...actorXlmVolume,
      metric: "asset_volume",
      unit: XLM_ASSET_UNIT,
    },
    xlm_actors_dest: {
      ...actorDestXlmVolume,
      metric: "asset_volume",
      unit: XLM_ASSET_UNIT,
    },
    usdc_events: {
      ...eventUsdcVolume,
      metric: "asset_volume",
      unit: USDC_ASSET_UNIT,
    },
    usdc_actors: {
      ...actorUsdcVolume,
      metric: "asset_volume",
      unit: USDC_ASSET_UNIT,
    },
    usdc_actors_dest: {
      ...actorDestUsdcVolume,
      metric: "asset_volume",
      unit: USDC_ASSET_UNIT,
    },
    protocol_tvl: buildProtocolTvlTreemap(protocolTvlResults),
  };
}

/** @deprecated Use buildActorTreemap or buildAllTreemaps */
export function buildTreemap(input: BuildTreemapInput): TreemapNode {
  return buildActorTreemap(input);
}

export function buildKpis(
  categories: CategoryRow[],
  contracts: ContractRow[],
  activeSourceAccounts: ActiveSourceAccountsRow[] = [],
  totalActiveContracts?: number,
  activeDestinationCount = 0,
): ActivityKpis {
  const totalOps = categories.reduce((sum, row) => sum + row.op_count, 0);
  const groupTotals = getGroupTotals(categories, "ops");
  const sorobanOps = groupTotals.get("soroban") ?? 0;

  const topCategoryEntry = [...groupTotals.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];

  // Prefer the uncapped distinct active-contract count when provided so the KPI
  // is not coupled to the capped leaderboard length.
  const activeWalletCount = activeSourceAccounts.reduce(
    (sum, row) => sum + row.active_accounts,
    0,
  );
  const activeContractCount =
    totalActiveContracts !== undefined ? totalActiveContracts : contracts.length;

  return {
    totalOps: {
      kind: "operations",
      unit: "ops",
      value: totalOps,
    },
    sorobanShare: {
      kind: "share",
      unit: "percent",
      value: totalOps > 0 ? (sorobanOps / totalOps) * 100 : 0,
    },
    topCategory: topCategoryEntry
      ? (GROUP_LABELS[topCategoryEntry[0]] ?? topCategoryEntry[0])
      : "N/A",
    activeContracts: {
      kind: "entity_count",
      unit: "count",
      value: activeContractCount,
    },
    activeWallets: {
      kind: "entity_count",
      unit: "count",
      value: activeWalletCount,
    },
    activeDestinationAccounts: {
      kind: "entity_count",
      unit: "count",
      value: activeDestinationCount,
    },
  };
}

function categoriesTotal(categories: CategoryRow[], metric: BuildMetricId): number {
  return categories.reduce((sum, row) => {
    const value = metric === "xlm_volume" ? (row.xlm_volume ?? 0) : row.op_count;
    return sum + value;
  }, 0);
}

const UNKNOWN_PROTOCOL = "unknown";

export function buildProtocolSummary(
  accounts: AccountRow[],
  contracts: ContractRow[],
  labels?: Record<string, EntityInfo>,
): ProtocolSummary {
  const protoOps = new Map<string, number>();
  const protoEntities = new Map<string, Set<string>>();

  const allAccounts = accounts.map((r) => ({
    id: r.account_id,
    opCount: r.op_count,
  }));
  const allContracts = contracts.map((r) => ({
    id: r.contract_id,
    opCount: r.op_count,
  }));

  for (const entry of [...allAccounts, ...allContracts]) {
    const entity = lookupEntity(entry.id, labels);
    const protocol = entity?.protocol?.trim() || UNKNOWN_PROTOCOL;

    protoOps.set(protocol, (protoOps.get(protocol) ?? 0) + entry.opCount);

    if (!protoEntities.has(protocol)) {
      protoEntities.set(protocol, new Set());
    }
    protoEntities.get(protocol)!.add(entry.id);
  }

  const totalOps =
    [...protoOps.values()].reduce((sum, v) => sum + v, 0);
  const unknownOps = protoOps.get(UNKNOWN_PROTOCOL) ?? 0;
  const labeledOps = totalOps - unknownOps;
  const coverage = totalOps > 0 ? (labeledOps / totalOps) * 100 : 0;

  const sorted = [...protoOps.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const diff = b[1] - a[1];
      if (diff !== 0) return diff;
      return a[0].localeCompare(b[0]);
    });

  const bars: ProtocolBar[] = sorted.map(([protocol, opCount], i) => ({
    protocol,
    opCount,
    share: totalOps > 0 ? (opCount / totalOps) * 100 : 0,
    rank: i + 1,
    entityCount: protoEntities.get(protocol)?.size ?? 0,
  }));

  return {
    bars,
    totalOps,
    labeledOps,
    coverage,
    unknownCount: protoEntities.get(UNKNOWN_PROTOCOL)?.size ?? 0,
  };
}

