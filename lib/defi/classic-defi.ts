import {
  CLAIMABLE_BALANCE_OP_TYPES,
  LIQUIDITY_POOL_OP_TYPES,
} from "@/lib/constants";
import type {
  AccountRow,
  ClassicDefiAccountRow,
  ClassicDefiBreakdown,
  ClassicDefiBreakdowns,
  ClassicDefiScope,
} from "@/lib/types";

const MAX_ROWS = 10;

function opTypesForScope(scope: ClassicDefiScope): string[] {
  return scope === "liquidity_pools"
    ? LIQUIDITY_POOL_OP_TYPES
    : CLAIMABLE_BALANCE_OP_TYPES;
}

/**
 * Ranks source accounts touching classic liquidity-pool or claimable-balance
 * operations. Built from the operation-type account rows Hubble already
 * returns (`op_source_account` per `type_string`); pool identity is not part of
 * the column contract, so pools are not ranked separately.
 */
export function buildClassicDefiBreakdown(
  accounts: AccountRow[],
  scope: ClassicDefiScope,
  limit = MAX_ROWS,
): ClassicDefiBreakdown {
  const typeOrder = opTypesForScope(scope);
  const typesInScope = new Set(typeOrder);

  const byAccount = new Map<string, Map<string, number>>();
  for (const row of accounts) {
    if (!typesInScope.has(row.type_string)) continue;
    const ops = Number(row.op_count) || 0;
    if (ops <= 0) continue;
    const perType = byAccount.get(row.account_id) ?? new Map<string, number>();
    perType.set(row.type_string, (perType.get(row.type_string) ?? 0) + ops);
    byAccount.set(row.account_id, perType);
  }

  const totalOps = [...byAccount.values()].reduce(
    (sum, perType) =>
      sum + [...perType.values()].reduce((partial, ops) => partial + ops, 0),
    0,
  );

  const ranked = [...byAccount.entries()]
    .map(([accountId, perType]): ClassicDefiAccountRow => {
      const ops = [...perType.values()].reduce((sum, value) => sum + value, 0);
      return {
        accountId,
        ops,
        scopeShare: totalOps > 0 ? (ops / totalOps) * 100 : 0,
        byType: typeOrder
          .filter((type_string) => perType.has(type_string))
          .map((type_string) => ({ type_string, ops: perType.get(type_string)! })),
      };
    })
    .sort((a, b) => b.ops - a.ops || a.accountId.localeCompare(b.accountId));

  return {
    scope,
    totalOps,
    rows: ranked.slice(0, limit),
    distinctAccounts: ranked.length,
    truncated: ranked.length > limit,
  };
}

/** Every scope's breakdown in one pass, for panels that show both tables. */
export function buildClassicDefiBreakdowns(
  accounts: AccountRow[],
): ClassicDefiBreakdowns {
  return {
    liquidityPools: buildClassicDefiBreakdown(accounts, "liquidity_pools"),
    claimableBalances: buildClassicDefiBreakdown(accounts, "claimable_balances"),
  };
}
