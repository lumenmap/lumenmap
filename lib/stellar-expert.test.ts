import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStellarExpertUrl,
  resolveStellarExpertEntityKind,
  resolveStellarExpertNetwork,
  stellarExpertAccessibleName,
  stellarExpertLinkLabel,
} from "@/lib/stellar-expert";

const ACCOUNT = "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";
const CONTRACT = "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2";

describe("buildStellarExpertUrl", () => {
  it("builds the public account route shape", () => {
    assert.equal(resolveStellarExpertNetwork(), "public");
    assert.equal(
      buildStellarExpertUrl(ACCOUNT, "account"),
      `https://stellar.expert/explorer/public/account/${ACCOUNT}`,
    );
  });

  it("builds the public contract route shape", () => {
    assert.equal(
      buildStellarExpertUrl(CONTRACT, "contract"),
      `https://stellar.expert/explorer/public/contract/${CONTRACT}`,
    );
  });

  it("infers kind from a well-formed ID prefix", () => {
    assert.equal(
      buildStellarExpertUrl(ACCOUNT),
      `https://stellar.expert/explorer/public/account/${ACCOUNT}`,
    );
    assert.equal(
      buildStellarExpertUrl(CONTRACT),
      `https://stellar.expert/explorer/public/contract/${CONTRACT}`,
    );
  });

  it("returns null for malformed identifiers", () => {
    assert.equal(buildStellarExpertUrl(undefined), null);
    assert.equal(buildStellarExpertUrl(""), null);
    assert.equal(buildStellarExpertUrl("not-an-address"), null);
    assert.equal(buildStellarExpertUrl("GSHORT"), null);
    assert.equal(buildStellarExpertUrl(`G${"A".repeat(55)}`.toLowerCase()), null);
    assert.equal(
      buildStellarExpertUrl("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1"),
      null,
    );
    assert.equal(buildStellarExpertUrl("CAAAAA"), null);
    // Meta type alone must not bypass validation.
    assert.equal(buildStellarExpertUrl("bad", "account"), null);
    assert.equal(buildStellarExpertUrl("bad", "contract"), null);
  });
});

describe("resolveStellarExpertEntityKind", () => {
  it("rejects mismatched type and prefix", () => {
    assert.equal(resolveStellarExpertEntityKind(ACCOUNT, "contract"), null);
    assert.equal(resolveStellarExpertEntityKind(CONTRACT, "account"), null);
  });
});

describe("stellar expert link labels", () => {
  it("identifies Stellar Expert and new-tab behavior", () => {
    assert.match(stellarExpertLinkLabel("account"), /Stellar Expert/);
    assert.match(stellarExpertLinkLabel("contract"), /Stellar Expert/);
    assert.match(
      stellarExpertAccessibleName(ACCOUNT, "account"),
      /Stellar Expert/,
    );
    assert.match(
      stellarExpertAccessibleName(ACCOUNT, "account"),
      /opens in a new tab/i,
    );
    assert.match(
      stellarExpertAccessibleName(CONTRACT, "contract"),
      /opens in a new tab/i,
    );
  });
});
