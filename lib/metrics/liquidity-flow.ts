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

export interface PathPaymentAmounts {
  xlmAmount: string | null;
  usdcAmount: string | null;
}

export interface LiquidityFlowIntermediateAsset {
  code: string;
  issuer?: string;
  routeAppearances: number;
}

export interface LiquidityFlowSummary {
  pathPaymentCount: number;
  dexOperationCount: number;
  liquidityPoolOperationCount: number;
  pathPaymentAmounts: PathPaymentAmounts | null;
  intermediateAssets: LiquidityFlowIntermediateAsset[];
  intermediateAssetsAvailable: boolean;
}

export interface PathPaymentIntermediateAssets {
  assets: LiquidityFlowIntermediateAsset[];
  available: boolean;
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
  };
}
