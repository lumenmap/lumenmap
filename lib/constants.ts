export const CATEGORY_COLORS: Record<string, string> = {
  soroban: "#7B61FF",
  payments: "#14B8A6",
  dex: "#F59E0B",
  trustlines: "#3B82F6",
  account: "#EC4899",
  other: "#6B7280",
};

/** Pattern variant used as secondary non-color category cue in the treemap. */
export const CATEGORY_PATTERNS: Record<string, string> = {
  soroban: "diagonal",
  payments: "horizontal",
  dex: "crosshatch",
  trustlines: "dots",
  account: "vertical",
  other: "none",
};

export const GROUP_LABELS: Record<string, string> = {
  soroban: "Soroban Contracts",
  payments: "Payments",
  dex: "DEX Trades",
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
  change_trust: "trustlines",
  set_options: "account",
  bump_sequence: "account",
  allow_trust: "account",
  manage_data: "account",
  create_claimable_balance: "account",
  claim_claimable_balance: "account",
  begin_sponsoring_future_reserves: "account",
  end_sponsoring_future_reserves: "account",
  revoke_sponsorship: "account",
  clawback: "account",
  clawback_claimable_balance: "account",
  set_trust_line_flags: "account",
  liquidity_pool_deposit: "dex",
  liquidity_pool_withdraw: "dex",
  inflation: "other",
  extend_footprint_ttl: "soroban",
  restore_footprint: "soroban",
};

export function getCategoryForOperation(type_string: string): string {
  return TYPE_TO_GROUP[type_string] ?? "other";
}

export {
  ACCOUNT_QUERY_TYPES,
  DESTINATION_QUERY_TYPES,
  TOP_ACCOUNTS_PER_TYPE,
  TOP_CONTRACT_LIMIT,
  TOP_CONTRACTS_PER_FUNCTION,
  TOP_SOROBAN_FUNCTIONS,
} from "@/lib/hubble/shared-queries.mjs";

export const TREEMAP_VIEWS = [
  {
    id: "events",
    label: "Operation Types",
    description: "Category → operation type or Soroban function → accounts or contracts.",
  },
  {
    id: "actors",
    label: "Accounts & Contracts",
    description: "Drill into top wallets, anchors, and Soroban contracts.",
  },
] as const;

export type TreemapViewId = (typeof TREEMAP_VIEWS)[number]["id"];

export const TOP_PROTOCOLS = 15;
