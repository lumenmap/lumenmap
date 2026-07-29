/**
 * Fixture data returned by /api/activity when BigQuery credentials are absent.
 * Used for front-end development and contributor onboarding without GCP access.
 * Values are illustrative; they do not reflect real network state.
 */

import type { ActivityResponse } from "@/lib/types";

export const fixtureResponse: ActivityResponse = {
  period: "1d",
  start: "2025-01-01T00:00:00.000Z",
  end: "2025-01-01T23:59:59.999Z",
  source: "hubble",
  categories: [
    { type_string: "invoke_host_function", op_count: 420000 },
    { type_string: "payment", op_count: 180000 },
    { type_string: "manage_sell_offer", op_count: 95000 },
    { type_string: "path_payment_strict_receive", op_count: 62000 },
    { type_string: "change_trust", op_count: 31000 },
    { type_string: "manage_buy_offer", op_count: 28000 },
    { type_string: "set_options", op_count: 15000 },
    { type_string: "extend_footprint_ttl", op_count: 12000 },
    { type_string: "create_account", op_count: 9000 },
    { type_string: "manage_data", op_count: 6000 },
    { type_string: "restore_footprint", op_count: 2000 },
  ],
  contracts: [
    {
      contract_id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
      op_count: 88000,
    },
    {
      contract_id: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
      op_count: 54000,
    },
    {
      contract_id: "CBIELTK6Y5Y5U5DT5OMY7C5QZQZQZQZQZQZQZQZQZQZQZQZQ",
      op_count: 31000,
    },
  ],
  accounts: [
    {
      account_id: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      type_string: "payment",
      op_count: 42000,
    },
    {
      account_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNKNLXLTCV",
      type_string: "payment",
      op_count: 18000,
    },
    {
      account_id: "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM",
      type_string: "manage_sell_offer",
      op_count: 27000,
    },
    {
      account_id: "GDKJ3ZXB5RA2MV5T2Y3Z5D3D3VKR5F7EFRB2A3BMBC3IHGBOK5GDI2LQ",
      type_string: "manage_buy_offer",
      op_count: 11000,
    },
  ],
  sorobanFunctions: [
    { function_name: "swap", op_count: 95000 },
    { function_name: "deposit", op_count: 62000 },
    { function_name: "withdraw", op_count: 41000 },
    { function_name: "transfer", op_count: 38000 },
    { function_name: "approve", op_count: 22000 },
  ],
  sorobanFunctionContracts: [
    {
      function_name: "swap",
      contract_id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
      op_count: 55000,
    },
    {
      function_name: "deposit",
      contract_id: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
      op_count: 38000,
    },
    {
      function_name: "withdraw",
      contract_id: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
      op_count: 24000,
    },
  ],
  kpis: {
    totalOps: 860000,
    sorobanShare: 0.51,
    topCategory: "soroban",
    activeContracts: 3,
  },
  treemaps: {
    events: {
      name: "Network Activity",
      children: [
        {
          name: "Soroban Contracts",
          value: 434000,
          meta: { type: "category", category: "soroban" },
          children: [
            {
              id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
              name: "Soroswap",
              value: 88000,
              meta: {
                type: "contract",
                category: "soroban",
                protocol: "Soroswap",
              },
            },
            {
              id: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
              name: "Soroswap Pool",
              value: 54000,
              meta: {
                type: "contract",
                category: "soroban",
                protocol: "Soroswap",
              },
            },
          ],
        },
        {
          name: "Payments",
          value: 251000,
          meta: { type: "category", category: "payments" },
          children: [
            {
              id: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
              name: "Circle USDC",
              value: 42000,
              meta: { type: "entity", category: "payments", protocol: "Circle" },
            },
          ],
        },
        {
          name: "DEX Trades",
          value: 123000,
          meta: { type: "category", category: "dex" },
        },
        {
          name: "Trustlines",
          value: 31000,
          meta: { type: "category", category: "trustlines" },
        },
        {
          name: "Account Operations",
          value: 21000,
          meta: { type: "category", category: "account" },
        },
      ],
    },
    actors: {
      name: "Accounts & Contracts",
      children: [
        {
          name: "Soroswap",
          id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
          value: 88000,
          meta: { type: "contract", category: "soroban", protocol: "Soroswap" },
        },
        {
          name: "Circle USDC",
          id: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          value: 42000,
          meta: { type: "entity", category: "payments", protocol: "Circle" },
        },
        {
          name: "Kraken",
          id: "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM",
          value: 27000,
          meta: { type: "entity", category: "dex", protocol: "Kraken" },
        },
        {
          name: "MoneyGram",
          id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNKNLXLTCV",
          value: 18000,
          meta: { type: "entity", category: "payments", protocol: "MoneyGram" },
        },
        {
          name: "LOBSTR",
          id: "GDKJ3ZXB5RA2MV5T2Y3Z5D3D3VKR5F7EFRB2A3BMBC3IHGBOK5GDI2LQ",
          value: 11000,
          meta: { type: "entity", category: "dex", protocol: "LOBSTR" },
        },
      ],
    },
  },
};
