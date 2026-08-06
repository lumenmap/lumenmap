import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAsset,
  getAssetKey,
  parseAssetKey,
  InvalidAssetError,
} from "./asset";

describe("Asset Identity", () => {
  describe("normalizeAsset", () => {
    it("should normalize native XLM", () => {
      const asset = normalizeAsset("native");
      assert.deepEqual(asset, { type: "native", code: "XLM" });
      
      const assetWithCode = normalizeAsset("native", "XLM");
      assert.deepEqual(assetWithCode, { type: "native", code: "XLM" });
    });

    it("should reject native XLM with an issuer", () => {
      assert.throws(() => normalizeAsset("native", "XLM", "GA5ZSEJYB37JRC52ZMRWDYGL2M5EE3P4K8E6O65O2U44ZYQYEQD5YYZ3"), InvalidAssetError);
      assert.throws(() => normalizeAsset("native", null, "GA5ZSEJYB37JRC52ZMRWDYGL2M5EE3P4K8E6O65O2U44ZYQYEQD5YYZ3"), InvalidAssetError);
    });

    it("should normalize credit_alphanum4", () => {
      const issuer = "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKEXD6";
      const asset = normalizeAsset("credit_alphanum4", "USDC", issuer);
      assert.deepEqual(asset, { type: "credit_alphanum4", code: "USDC", issuer });
    });

    it("should normalize credit_alphanum12", () => {
      const issuer = "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKEXD6";
      const asset = normalizeAsset("credit_alphanum12", "LUMENMAPCOIN", issuer);
      assert.deepEqual(asset, { type: "credit_alphanum12", code: "LUMENMAPCOIN", issuer });
    });

    it("should reject issued asset without issuer", () => {
      assert.throws(() => normalizeAsset("credit_alphanum4", "USDC"), InvalidAssetError);
      assert.throws(() => normalizeAsset("credit_alphanum4", "USDC", " "), InvalidAssetError);
    });

    it("should reject issued asset without code", () => {
      const issuer = "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKEXD6";
      assert.throws(() => normalizeAsset("credit_alphanum4", null, issuer), InvalidAssetError);
    });

    it("should reject credit_alphanum4 with code > 4", () => {
      const issuer = "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKEXD6";
      assert.throws(() => normalizeAsset("credit_alphanum4", "USDCC", issuer), InvalidAssetError);
    });

    it("should reject credit_alphanum12 with code <= 4 or > 12", () => {
      const issuer = "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKEXD6";
      assert.throws(() => normalizeAsset("credit_alphanum12", "USDC", issuer), InvalidAssetError);
      assert.throws(() => normalizeAsset("credit_alphanum12", "THISISWAYTOOLONG", issuer), InvalidAssetError);
    });

    it("should reject unknown types", () => {
      assert.throws(() => normalizeAsset("bitcoin"), InvalidAssetError);
    });
  });

  describe("getAssetKey / parseAssetKey", () => {
    it("should serialize and deserialize native", () => {
      const asset = normalizeAsset("native");
      const key = getAssetKey(asset);
      assert.equal(key, "native");
      
      const parsed = parseAssetKey(key);
      assert.deepEqual(parsed, asset);
    });

    it("should serialize and deserialize credit_alphanum4", () => {
      const issuer = "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKEXD6";
      const asset = normalizeAsset("credit_alphanum4", "USDC", issuer);
      const key = getAssetKey(asset);
      assert.equal(key, `USDC:${issuer}`);
      
      const parsed = parseAssetKey(key);
      assert.deepEqual(parsed, asset);
    });

    it("should serialize and deserialize credit_alphanum12", () => {
      const issuer = "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKEXD6";
      const asset = normalizeAsset("credit_alphanum12", "LONGCOIN", issuer);
      const key = getAssetKey(asset);
      assert.equal(key, `LONGCOIN:${issuer}`);
      
      const parsed = parseAssetKey(key);
      assert.deepEqual(parsed, asset);
    });

    it("should produce different keys for same code but different issuers", () => {
      const issuer1 = "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKEXD6";
      const issuer2 = "GA5ZSEJYB37JRC52ZMRWDYGL2M5EE3P4K8E6O65O2U44ZYQYEQD5YYZ3";
      
      const asset1 = normalizeAsset("credit_alphanum4", "USDC", issuer1);
      const asset2 = normalizeAsset("credit_alphanum4", "USDC", issuer2);
      
      assert.notEqual(getAssetKey(asset1), getAssetKey(asset2));
    });
  });
});
