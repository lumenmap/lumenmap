export const CATEGORY_COLORS: Record<string, string> = {
  soroban: "var(--color-soroban)",
  payments: "var(--color-payments)",
  dex: "var(--color-dex)",
  liquidity_pools: "var(--color-liquidity-pools)",
  claimable_balances: "var(--color-claimable-balances)",
  trustlines: "var(--color-trustlines)",
  account: "var(--color-account)",
  other: "var(--color-other)",
};

/** Pattern variant used as secondary non-color category cue in the treemap. */
export const CATEGORY_PATTERNS: Record<string, string> = {
  soroban: "diagonal",
  payments: "horizontal",
  dex: "crosshatch",
  liquidity_pools: "grid",
  claimable_balances: "diamond",
  trustlines: "dots",
  account: "vertical",
  other: "none",
};

export const GROUP_LABELS: Record<string, string> = {
  soroban: "Soroban Contracts",
  payments: "Payments",
  dex: "DEX Trades",
  liquidity_pools: "Liquidity Pools",
  claimable_balances: "Claimable Balances",
  trustlines: "Trustlines",
  account: "Account Operations",
  other: "Other",
};

export const TYPE_TO_GROUP: Record<string, string> = {
  invoke_host_function: "soroban",
  payment: "payments",
  path_payment_strict_receive: "payments",
  path_payment_strict_send: "payments",
  create_account: "payments",
  account_merge: "payments",
  manage_buy_offer: "dex",
  manage_sell_offer: "dex",
  create_passive_sell_offer: "dex",
  liquidity_pool_deposit: "liquidity_pools",
  liquidity_pool_withdraw: "liquidity_pools",
  change_trust: "trustlines",
  set_options: "account",
  bump_sequence: "account",
  allow_trust: "account",
  manage_data: "account",
  create_claimable_balance: "claimable_balances",
  claim_claimable_balance: "claimable_balances",
  clawback_claimable_balance: "claimable_balances",
  begin_sponsoring_future_reserves: "account",
  end_sponsoring_future_reserves: "account",
  revoke_sponsorship: "account",
  clawback: "account",
  set_trust_line_flags: "account",
  inflation: "other",
  extend_footprint_ttl: "soroban",
  restore_footprint: "soroban",
};

export function getCategoryForOperation(type_string: string): string {
  return TYPE_TO_GROUP[type_string] ?? "other";
}

/** Classic liquidity-pool operation types, derived from the category table. */
export const LIQUIDITY_POOL_OP_TYPES: string[] = Object.keys(TYPE_TO_GROUP).filter(
  (type) => TYPE_TO_GROUP[type] === "liquidity_pools",
);

/** Classic claimable-balance operation types, derived from the category table. */
export const CLAIMABLE_BALANCE_OP_TYPES: string[] = Object.keys(TYPE_TO_GROUP).filter(
  (type) => TYPE_TO_GROUP[type] === "claimable_balances",
);

export {
  ACCOUNT_QUERY_TYPES,
  DESTINATION_QUERY_TYPES,
  TOP_ACCOUNTS_PER_TYPE,
  TOP_CONTRACT_LIMIT,
  TOP_CONTRACTS_PER_FUNCTION,
  TOP_FUNCTIONS_PER_CONTRACT,
  TOP_SOROBAN_FUNCTIONS,
} from "@/lib/hubble/shared-queries.mjs";

export const TREEMAP_VIEWS = [
  {
    id: "events",
    label: "Operation Types",
    description:
      "Category → operation type or Soroban function → accounts or contracts.",
  },
  {
    id: "actors",
    label: "Top Senders",
    description: "Drill into top wallets, anchors, and Soroban contracts by source account.",
  },
  {
    id: "actors_dest",
    label: "Top Receivers",
    description: "Drill into top receiving accounts for payment and funding operations.",
  },
  {
    id: "flow",
    label: "Payment Flow",
    description: "Value movement and payment flows between accounts.",
  },
] as const;

export type TreemapViewId = (typeof TREEMAP_VIEWS)[number]["id"];

/**
 * Top-level chart views rendered inside the Network chart card. The Flow view
 * is experimental and only offered when the Flow feature flag is enabled.
 */
export const CHART_VIEWS = [
  { id: "treemap", label: "Treemap" },
  { id: "flow", label: "Flow" },
] as const;

export type ChartViewId = (typeof CHART_VIEWS)[number]["id"];

export const TOP_PROTOCOLS = 15;
