import type { CategoryRow } from "@/lib/types";

export const PATH_PAYMENT_OPERATION_TYPES = [
  "path_payment_strict_receive",
  "path_payment_strict_send",
] as const;

export const DEX_OPERATION_TYPES = [
  "manage_buy_offer",
  "manage_sell_offer",
  "create_passive_sell_offer",
] as const;

export const LIQUIDITY_POOL_OPERATION_TYPES = [
  "liquidity_pool_deposit",
  "liquidity_pool_withdraw",
] as const;

/** Top-level liquidity routing split buckets shown in the summary panel. */
export const LIQUIDITY_FLOW_SPLIT_BUCKETS = [
  "manage_offer",
  "path_payment",
  "related",
] as const;

export type LiquidityFlowSplitBucket =
  (typeof LIQUIDITY_FLOW_SPLIT_BUCKETS)[number];

export const LIQUIDITY_FLOW_SPLIT_LABELS: Record<
  LiquidityFlowSplitBucket,
  string
> = {
  manage_offer: "Manage offers",
  path_payment: "Path payments",
  related: "Related (liquidity pools)",
};

const BUCKET_OPERATION_TYPES: Record<
  LiquidityFlowSplitBucket,
  readonly string[]
> = {
  manage_offer: DEX_OPERATION_TYPES,
  path_payment: PATH_PAYMENT_OPERATION_TYPES,
  related: LIQUIDITY_POOL_OPERATION_TYPES,
};

/** Every subtype that participates in the DEX / path-payment / related split. */
export const LIQUIDITY_FLOW_SPLIT_SUBTYPES: readonly string[] = [
  ...DEX_OPERATION_TYPES,
  ...PATH_PAYMENT_OPERATION_TYPES,
  ...LIQUIDITY_POOL_OPERATION_TYPES,
];

export interface PathPaymentAmounts {
  xlmAmount: string | null;
  usdcAmount: string | null;
}

export interface LiquidityFlowIntermediateAsset {
  code: string;
  issuer?: string;
  routeAppearances: number;
}

export interface LiquidityFlowSubtypeShare {
  type: string;
  opCount: number;
  /** False when Hubble omitted this subtype from the category set (soft-fail). */
  available: boolean;
}

export interface LiquidityFlowSplitRow {
  bucket: LiquidityFlowSplitBucket;
  label: string;
  opCount: number;
  /** Share of the three-bucket total, in [0, 1]. */
  share: number;
  subtypes: LiquidityFlowSubtypeShare[];
}

export interface LiquidityFlowSplit {
  rows: LiquidityFlowSplitRow[];
  totalOpCount: number;
  /** Subtypes present in the category input (even with zero count). */
  presentSubtypes: string[];
  /** Documented subtypes absent from the category input; counts soft-fail to 0. */
  missingSubtypes: string[];
}

export interface LiquidityFlowSummary {
  pathPaymentCount: number;
  dexOperationCount: number;
  liquidityPoolOperationCount: number;
  pathPaymentAmounts: PathPaymentAmounts | null;
  intermediateAssets: LiquidityFlowIntermediateAsset[];
  intermediateAssetsAvailable: boolean;
  /** Manage-offer / path-payment / related operation shares. */
  split: LiquidityFlowSplit;
}

export interface PathPaymentIntermediateAssets {
  assets: LiquidityFlowIntermediateAsset[];
  available: boolean;
}

export type LiquidityFlowCsvRow = {
  bucket: string;
  label: string;
  op_count: number;
  share: string;
  subtype: string;
  subtype_op_count: number;
  subtype_available: boolean;
};

/**
 * Classifies a Stellar operation type into the liquidity-flow split.
 * Returns null for types outside the documented inclusion set.
 */
export function classifyLiquidityFlowOpType(
  typeString: string,
): LiquidityFlowSplitBucket | null {
  if ((DEX_OPERATION_TYPES as readonly string[]).includes(typeString)) {
    return "manage_offer";
  }
  if ((PATH_PAYMENT_OPERATION_TYPES as readonly string[]).includes(typeString)) {
    return "path_payment";
  }
  if (
    (LIQUIDITY_POOL_OPERATION_TYPES as readonly string[]).includes(typeString)
  ) {
    return "related";
  }
  return null;
}

function sumOperationTypes(
  categories: CategoryRow[],
  types: readonly string[],
): number {
  const includedTypes = new Set(types);
  return categories.reduce(
    (total, row) =>
      includedTypes.has(row.type_string) && Number.isFinite(row.op_count)
        ? total + Math.max(0, row.op_count)
        : total,
    0,
  );
}

function countByType(categories: CategoryRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of categories) {
    if (!Number.isFinite(row.op_count)) continue;
    const next = (counts.get(row.type_string) ?? 0) + Math.max(0, row.op_count);
    counts.set(row.type_string, next);
  }
  return counts;
}

/**
 * Builds the three-bucket share table. Missing subtypes soft-fail to count 0
 * with `available: false`; they do not fail the activity response.
 */
export function buildLiquidityFlowSplit(
  categories: CategoryRow[],
): LiquidityFlowSplit {
  const counts = countByType(categories);
  const presentSubtypes = LIQUIDITY_FLOW_SPLIT_SUBTYPES.filter((type) =>
    counts.has(type),
  );
  const missingSubtypes = LIQUIDITY_FLOW_SPLIT_SUBTYPES.filter(
    (type) => !counts.has(type),
  );

  const provisional = LIQUIDITY_FLOW_SPLIT_BUCKETS.map((bucket) => {
    const subtypes = BUCKET_OPERATION_TYPES[bucket].map((type) => {
      const available = counts.has(type);
      return {
        type,
        opCount: available ? (counts.get(type) ?? 0) : 0,
        available,
      };
    });
    const opCount = subtypes.reduce((sum, row) => sum + row.opCount, 0);
    return {
      bucket,
      label: LIQUIDITY_FLOW_SPLIT_LABELS[bucket],
      opCount,
      subtypes,
    };
  });

  const totalOpCount = provisional.reduce((sum, row) => sum + row.opCount, 0);

  return {
    rows: provisional.map((row) => ({
      ...row,
      share: totalOpCount === 0 ? 0 : row.opCount / totalOpCount,
    })),
    totalOpCount,
    presentSubtypes,
    missingSubtypes,
  };
}

/** Flat CSV row set for the DEX / path-payment / related split. */
export function liquidityFlowSplitToCsvRows(
  split: LiquidityFlowSplit,
): LiquidityFlowCsvRow[] {
  const rows: LiquidityFlowCsvRow[] = [];
  for (const row of split.rows) {
    for (const subtype of row.subtypes) {
      rows.push({
        bucket: row.bucket,
        label: row.label,
        op_count: row.opCount,
        share: row.share.toFixed(6),
        subtype: subtype.type,
        subtype_op_count: subtype.opCount,
        subtype_available: subtype.available,
      });
    }
  }
  return rows;
}

function escapeCsvField(value: string | number | boolean): string {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Serializes the split share table for download. */
export function serializeLiquidityFlowSplitToCsv(
  split: LiquidityFlowSplit,
): string {
  const header =
    "bucket,label,op_count,share,subtype,subtype_op_count,subtype_available";
  const body = liquidityFlowSplitToCsvRows(split).map((row) =>
    [
      escapeCsvField(row.bucket),
      escapeCsvField(row.label),
      escapeCsvField(row.op_count),
      escapeCsvField(row.share),
      escapeCsvField(row.subtype),
      escapeCsvField(row.subtype_op_count),
      escapeCsvField(row.subtype_available),
    ].join(","),
  );
  return [header, ...body].join("\n");
}

export function buildLiquidityFlowSummary(
  categories: CategoryRow[],
  pathPaymentAmounts: PathPaymentAmounts | null,
  intermediateAssets: PathPaymentIntermediateAssets | null,
): LiquidityFlowSummary {
  return {
    pathPaymentCount: sumOperationTypes(
      categories,
      PATH_PAYMENT_OPERATION_TYPES,
    ),
    dexOperationCount: sumOperationTypes(categories, DEX_OPERATION_TYPES),
    liquidityPoolOperationCount: sumOperationTypes(
      categories,
      LIQUIDITY_POOL_OPERATION_TYPES,
    ),
    pathPaymentAmounts,
    intermediateAssets: intermediateAssets?.assets ?? [],
    intermediateAssetsAvailable: intermediateAssets?.available ?? false,
    split: buildLiquidityFlowSplit(categories),
  };
}
