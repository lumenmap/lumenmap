#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("data/usdc-assets.json", "utf8"));
const supported = new Set(
  config.assets.map((asset) => `${asset.code}:${asset.issuer}`),
);

function isSupported(identity) {
  return supported.has(`${identity.code}:${identity.issuer}`);
}

function selectedAssetAndAmount(op) {
  if (op.type_string === "payment") {
    return {
      code: op.asset_code,
      issuer: op.asset_issuer,
      amount: op.amount,
    };
  }

  if (op.type_string === "path_payment_strict_receive") {
    return {
      code: op.asset_code,
      issuer: op.asset_issuer,
      amount: op.amount,
    };
  }

  if (op.type_string === "path_payment_strict_send") {
    return {
      code: op.source_asset_code,
      issuer: op.source_asset_issuer,
      amount: op.source_amount,
    };
  }

  return null;
}

function aggregateUsdcVolume(operations) {
  return operations.reduce((total, op) => {
    const selected = selectedAssetAndAmount(op);
    if (!selected || !isSupported(selected)) {
      return total;
    }

    return total + Number(selected.amount);
  }, 0);
}

const [circle] = config.assets;
const unsupportedIssuer = "GUNSUPPORTEDUSDCISSUER0000000000000000000000000000000000000000";

assert.equal(config.id, "stellar-mainnet-circle-usdc-v1");
assert.equal(config.methodology, "canonical-payment-volume-v1");
assert.ok(circle.provenance.length >= 2);
assert.equal(isSupported({ code: "USDC", issuer: circle.issuer }), true);
assert.equal(isSupported({ code: "USDC", issuer: unsupportedIssuer }), false);

assert.equal(
  aggregateUsdcVolume([
    {
      type_string: "payment",
      asset_code: "USDC",
      asset_issuer: circle.issuer,
      amount: "10.5",
    },
    {
      type_string: "payment",
      asset_code: "USDC",
      asset_issuer: unsupportedIssuer,
      amount: "999",
    },
    {
      type_string: "path_payment_strict_receive",
      asset_code: "USDC",
      asset_issuer: circle.issuer,
      amount: "4",
      source_asset_code: "XLM",
      source_amount: "20",
    },
    {
      type_string: "path_payment_strict_send",
      asset_code: "EURC",
      asset_issuer: "GEURCISSUER",
      amount: "6",
      source_asset_code: "USDC",
      source_asset_issuer: circle.issuer,
      source_amount: "3",
    },
    {
      type_string: "path_payment_strict_send",
      asset_code: "USDC",
      asset_issuer: circle.issuer,
      amount: "100",
      source_asset_code: "XLM",
      source_amount: "25",
    },
  ]),
  17.5,
);

assert.equal(aggregateUsdcVolume([]), 0);

console.log("USDC payment-volume unit tests passed.");