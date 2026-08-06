#!/usr/bin/env node

import {
  queryRegistry,
  categoryQuery,
  contractQuery,
  activeContractCountQuery,
  accountQuery,
  sorobanFunctionQuery,
  sorobanFunctionContractQuery,
  nativePaymentVolumeQuery,
  usdcPaymentVolumeQuery,
  activeDestinationCountQuery,
  latestDataTimestampQuery,
  accountMetadataQuery,
  activeSourceAccountsQuery,
  usdcCategoryQuery,
  usdcAccountQuery,
  transactionCategoryQuery,
} from "../lib/hubble/shared-queries.mjs";

const queryMap = {
  categoryQuery,
  contractQuery,
  activeContractCountQuery,
  accountQuery,
  sorobanFunctionQuery,
  sorobanFunctionContractQuery,
  nativePaymentVolumeQuery,
  usdcPaymentVolumeQuery,
  activeDestinationCountQuery,
  latestDataTimestampQuery,
  accountMetadataQuery,
  activeSourceAccountsQuery,
  usdcCategoryQuery,
  usdcAccountQuery,
  transactionCategoryQuery,
};

const registeredNames = new Set(queryRegistry.map((e) => e.name));
let failed = false;

for (const [name] of Object.entries(queryMap)) {
  if (!registeredNames.has(name)) {
    console.log(`FAIL: ${name} is exported but missing from queryRegistry`);
    failed = true;
  }
}

for (const entry of queryRegistry) {
  if (!queryMap[entry.name]) {
    console.log(`FAIL: queryRegistry has "${entry.name}" but no matching export`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`ok — all ${queryRegistry.length} queries registered`);
