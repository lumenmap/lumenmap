import type {
  AccountRow,
  CategoryRow,
  ContractRow,
  Period,
  SorobanFunctionContractRow,
  SorobanFunctionRow,
  TransactionCategoryRow,
} from "../types";

/**
 * Deterministic raw activity rows used to serve the dashboard in fixture
 * mode (`LUMENMAP_DATA_SOURCE=fixture`). The values are static and scaled
 * by a fixed multiplier per period, which makes browser-level tests
 * (Playwright) fully deterministic: no GCP credentials, no BigQuery, and
 * no network access are required to reproduce them.
 */

export interface FixtureRawActivity {
  categories: CategoryRow[];
  transactionCategories: TransactionCategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
}

/** Fixed scale factor per period so each metric switch changes visible data. */
export const FIXTURE_PERIOD_MULTIPLIERS: Record<Period, number> = {
  "1d": 1,
  "7d": 6,
  "30d": 24,
  month: 18,
};

/**
 * Soroban contract ids used by the fixtures. The named ones exist in
 * `data/entities.json` / `data/directory.json`, so labels resolve locally
 * without calling the Stellar Expert directory.
 */
export const FIXTURE_CONTRACTS = {
  soroswap: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
  soroswapPool: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
  soroswapRouter: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH",
  unknown: "CDJNK5S2JYK6N7PRBGEKU3HVTL2GXQDAB5WJ5NJ3GMU2ZKZYQWGNHW54",
  /**
   * Exists only in the previous-window fixture rows so the treemap diff
   * overlay can render a "dropped" tile/table row (issue #447).
   */
  dropped: "CDROPPEDFIXTURECONTRACTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
} as const;

/** Stellar account ids used by the fixtures (named ones resolve locally). */
export const FIXTURE_ACCOUNTS = {
  kraken: "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM",
  lobstr: "GDKJ3ZXB5RA2MV5T2Y3Z5D3D3VKR5F7EFRB2A3BMBC3IHGBOK5GDI2LQ",
  moneygram: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNKNLXLTCV",
  unknownA: "GBKMNW2R7QZQF2ZDHBUXC3LKSRMURBPNBDD7N2TDRVSJTTHU3QFAARP2",
  unknownB: "GESJPCT5YWJ3XGD4YU4Z4JJFULBHAANZTFFKV27FHCXOGRN7TRFWZZRC",
  unknownC: "GDLMFPDMXP6HLU53JJA3UBC533SZ4QZXQMVOXDKEJW27FKJN4UPSBJ5G",
} as const;

/** Operations by type for a single day (scaled per period). */
const BASE_CATEGORIES: CategoryRow[] = [
  { type_string: "invoke_host_function", op_count: 420_000 },
  { type_string: "extend_footprint_ttl", op_count: 60_000 },
  { type_string: "restore_footprint", op_count: 12_000 },
  { type_string: "payment", op_count: 250_000 },
  { type_string: "path_payment_strict_receive", op_count: 34_000 },
  { type_string: "path_payment_strict_send", op_count: 9_000 },
  { type_string: "create_account", op_count: 6_000 },
  { type_string: "manage_sell_offer", op_count: 90_000 },
  { type_string: "manage_buy_offer", op_count: 70_000 },
  { type_string: "liquidity_pool_deposit", op_count: 8_000 },
  { type_string: "liquidity_pool_withdraw", op_count: 6_000 },
  { type_string: "change_trust", op_count: 21_000 },
  { type_string: "set_options", op_count: 7_500 },
  { type_string: "manage_data", op_count: 4_500 },
  { type_string: "inflation", op_count: 1_500 },
];

/** Distinct transactions by operation type for a single day (scaled per period). */
const BASE_TRANSACTION_CATEGORIES: TransactionCategoryRow[] = [
  { type_string: "payment", txn_count: 190_000 },
  { type_string: "invoke_host_function", txn_count: 95_000 },
  { type_string: "manage_sell_offer", txn_count: 38_000 },
  { type_string: "manage_buy_offer", txn_count: 29_000 },
  { type_string: "change_trust", txn_count: 12_000 },
  { type_string: "extend_footprint_ttl", txn_count: 9_500 },
  { type_string: "path_payment_strict_receive", txn_count: 8_200 },
  { type_string: "create_account", txn_count: 4_100 },
  { type_string: "set_options", txn_count: 3_400 },
  { type_string: "restore_footprint", txn_count: 2_200 },
];

/** Top contracts for a single day (scaled per period). */
const BASE_CONTRACTS: ContractRow[] = [
  { contract_id: FIXTURE_CONTRACTS.soroswap, op_count: 150_000 },
  { contract_id: FIXTURE_CONTRACTS.soroswapPool, op_count: 90_000 },
  { contract_id: FIXTURE_CONTRACTS.soroswapRouter, op_count: 60_000 },
  { contract_id: FIXTURE_CONTRACTS.unknown, op_count: 42_000 },
];

/** Top accounts per operation type for a single day (scaled per period). */
const BASE_ACCOUNTS: AccountRow[] = [
  { account_id: FIXTURE_ACCOUNTS.kraken, type_string: "payment", op_count: 90_000 },
  { account_id: FIXTURE_ACCOUNTS.lobstr, type_string: "payment", op_count: 60_000 },
  { account_id: FIXTURE_ACCOUNTS.unknownA, type_string: "payment", op_count: 20_000 },
  {
    account_id: FIXTURE_ACCOUNTS.unknownB,
    type_string: "path_payment_strict_receive",
    op_count: 12_000,
  },
  {
    account_id: FIXTURE_ACCOUNTS.kraken,
    type_string: "path_payment_strict_receive",
    op_count: 9_000,
  },
  {
    account_id: FIXTURE_ACCOUNTS.lobstr,
    type_string: "path_payment_strict_send",
    op_count: 4_000,
  },
  {
    account_id: FIXTURE_ACCOUNTS.kraken,
    type_string: "create_account",
    op_count: 4_000,
  },
  {
    account_id: FIXTURE_ACCOUNTS.lobstr,
    type_string: "manage_sell_offer",
    op_count: 30_000,
  },
  {
    account_id: FIXTURE_ACCOUNTS.unknownC,
    type_string: "manage_sell_offer",
    op_count: 25_000,
  },
  {
    account_id: FIXTURE_ACCOUNTS.unknownC,
    type_string: "manage_buy_offer",
    op_count: 22_000,
  },
  {
    account_id: FIXTURE_ACCOUNTS.lobstr,
    type_string: "liquidity_pool_deposit",
    op_count: 3_000,
  },
  {
    account_id: FIXTURE_ACCOUNTS.kraken,
    type_string: "liquidity_pool_withdraw",
    op_count: 2_500,
  },
  {
    account_id: FIXTURE_ACCOUNTS.moneygram,
    type_string: "change_trust",
    op_count: 8_000,
  },
];

/**
 * Previous equal-length window adjustments (issue #447).
 *
 * `getFixturePreviousRawActivity` scales the same base rows by these factors
 * so the diff overlay always has deterministic tiles in every diverging
 * bucket: growth (payment), strong growth (change_trust), decline
 * (invoke_host_function), strong decline (set_options), and flat (anything
 * unlisted). Factors are multipliers on the previous window, so a factor
 * above 1 makes the *current* tile look like it declined, and vice versa.
 */
const PREVIOUS_WINDOW_CATEGORY_FACTORS: Record<string, number> = {
  invoke_host_function: 1.25,
  restore_footprint: 0.75,
  payment: 0.8,
  path_payment_strict_receive: 1.15,
  manage_sell_offer: 0.85,
  manage_buy_offer: 1.2,
  change_trust: 0.6,
  set_options: 1.4,
  inflation: 0.5,
};

const PREVIOUS_WINDOW_TXN_CATEGORY_FACTORS: Record<string, number> = {
  payment: 0.75,
  invoke_host_function: 1.3,
  manage_sell_offer: 0.9,
};

/**
 * `soroswapRouter` is intentionally absent from the previous window: it is
 * "new" in the current window. `dropped` is added below so it only exists in
 * the previous window.
 */
const PREVIOUS_WINDOW_CONTRACT_FACTORS: Record<string, number> = {
  [FIXTURE_CONTRACTS.soroswap]: 1.25,
  [FIXTURE_CONTRACTS.soroswapPool]: 0.8,
  [FIXTURE_CONTRACTS.unknown]: 1,
  [FIXTURE_CONTRACTS.dropped]: 1,
};

const PREVIOUS_WINDOW_DROPPED_CONTRACT_OPS = 45_000;

const PREVIOUS_WINDOW_ACCOUNT_FACTORS: Record<string, number> = {
  [FIXTURE_ACCOUNTS.kraken]: 0.9,
  [FIXTURE_ACCOUNTS.lobstr]: 1.1,
};

const PREVIOUS_WINDOW_SOROBAN_FUNCTION_FACTORS: Record<string, number> = {
  transfer: 1.2,
  swap: 0.85,
  balance: 1.25,
};

/** Soroban function invocations for a single day (scaled per period). */
const BASE_SOROBAN_FUNCTIONS: SorobanFunctionRow[] = [
  { function_name: "transfer", op_count: 190_000 },
  { function_name: "swap", op_count: 118_000 },
  { function_name: "deposit", op_count: 58_000 },
  { function_name: "balance", op_count: 32_000 },
];

/** Top contracts per Soroban function for a single day (scaled per period). */
const BASE_SOROBAN_FUNCTION_CONTRACTS: SorobanFunctionContractRow[] = [
  { function_name: "transfer", contract_id: FIXTURE_CONTRACTS.soroswap, op_count: 70_000 },
  { function_name: "transfer", contract_id: FIXTURE_CONTRACTS.soroswapRouter, op_count: 45_000 },
  { function_name: "transfer", contract_id: FIXTURE_CONTRACTS.unknown, op_count: 25_000 },
  { function_name: "swap", contract_id: FIXTURE_CONTRACTS.soroswap, op_count: 80_000 },
  { function_name: "swap", contract_id: FIXTURE_CONTRACTS.soroswapPool, op_count: 60_000 },
  { function_name: "deposit", contract_id: FIXTURE_CONTRACTS.soroswapPool, op_count: 30_000 },
  { function_name: "deposit", contract_id: FIXTURE_CONTRACTS.unknown, op_count: 18_000 },
  { function_name: "balance", contract_id: FIXTURE_CONTRACTS.unknown, op_count: 12_000 },
  { function_name: "balance", contract_id: FIXTURE_CONTRACTS.soroswapRouter, op_count: 9_000 },
];

function scaleRows<T extends { op_count: number }>(
  rows: T[],
  multiplier: number,
): T[] {
  return rows.map((row) => ({ ...row, op_count: row.op_count * multiplier }));
}

function scaleTxnRows(
  rows: TransactionCategoryRow[],
  multiplier: number,
): TransactionCategoryRow[] {
  return rows.map((row) => ({ ...row, txn_count: row.txn_count * multiplier }));
}

function scaleRowsWithFactors<T extends { op_count: number }>(
  rows: T[],
  multiplier: number,
  factors: Record<string, number>,
  key: (row: T) => string,
): T[] {
  return rows.map((row) => ({
    ...row,
    op_count:
      row.op_count * multiplier * (factors[key(row)] ?? 1),
  }));
}

/**
 * Returns the deterministic raw activity rows for a period.
 * Every period gets a distinct, stable total so tests can assert that
 * switching metrics updates the visible data.
 */
export function getFixtureRawActivity(period: Period): FixtureRawActivity {
  const multiplier = FIXTURE_PERIOD_MULTIPLIERS[period];

  return {
    categories: scaleRows(BASE_CATEGORIES, multiplier),
    transactionCategories: scaleTxnRows(BASE_TRANSACTION_CATEGORIES, multiplier),
    contracts: scaleRows(BASE_CONTRACTS, multiplier),
    accounts: scaleRows(BASE_ACCOUNTS, multiplier),
    sorobanFunctions: scaleRows(BASE_SOROBAN_FUNCTIONS, multiplier),
    sorobanFunctionContracts: scaleRows(
      BASE_SOROBAN_FUNCTION_CONTRACTS,
      multiplier,
    ),
  };
}

/**
 * Returns the deterministic raw activity rows for the previous equal-length
 * window (issue #447). The same base rows are scaled per entity so the
 * treemap diff overlay can force growth, decline, new, and dropped tiles:
 *
 * - `payment` categories grew (+25%) while `invoke_host_function` declined
 *   (-20%) versus the previous window.
 * - `soroswapRouter` exists only in the current window ("new" tile).
 * - `FIXTURE_CONTRACTS.dropped` exists only in the previous window
 *   ("dropped" table row).
 *
 * Unlisted rows keep the same scale, giving flat tiles for comparison.
 */
export function getFixturePreviousRawActivity(
  period: Period,
): FixtureRawActivity {
  const multiplier = FIXTURE_PERIOD_MULTIPLIERS[period];

  const contracts = BASE_CONTRACTS.filter(
    (row) => row.contract_id !== FIXTURE_CONTRACTS.soroswapRouter,
  )
    .concat([
      {
        contract_id: FIXTURE_CONTRACTS.dropped,
        op_count: PREVIOUS_WINDOW_DROPPED_CONTRACT_OPS,
      },
    ])
    .map((row) => ({
      ...row,
      op_count:
        row.op_count *
        multiplier *
        (PREVIOUS_WINDOW_CONTRACT_FACTORS[row.contract_id] ?? 1),
    }));

  return {
    categories: scaleRowsWithFactors(
      BASE_CATEGORIES,
      multiplier,
      PREVIOUS_WINDOW_CATEGORY_FACTORS,
      (row) => row.type_string,
    ),
    transactionCategories: BASE_TRANSACTION_CATEGORIES.map((row) => ({
      ...row,
      txn_count:
        row.txn_count *
        multiplier *
        (PREVIOUS_WINDOW_TXN_CATEGORY_FACTORS[row.type_string] ?? 1),
    })),
    contracts,
    accounts: scaleRowsWithFactors(
      BASE_ACCOUNTS,
      multiplier,
      PREVIOUS_WINDOW_ACCOUNT_FACTORS,
      (row) => row.account_id,
    ),
    sorobanFunctions: scaleRowsWithFactors(
      BASE_SOROBAN_FUNCTIONS,
      multiplier,
      PREVIOUS_WINDOW_SOROBAN_FUNCTION_FACTORS,
      (row) => row.function_name,
    ),
    sorobanFunctionContracts: BASE_SOROBAN_FUNCTION_CONTRACTS.filter(
      (row) => row.contract_id !== FIXTURE_CONTRACTS.soroswapRouter,
    ).map((row) => ({
      ...row,
      op_count:
        row.op_count *
        multiplier *
        (PREVIOUS_WINDOW_SOROBAN_FUNCTION_FACTORS[row.function_name] ?? 1),
    })),
  };
}
