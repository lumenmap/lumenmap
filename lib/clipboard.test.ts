import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { copyText, isEligibleAddress } from "@/lib/clipboard";
import { truncateAddress } from "@/lib/utils";

describe("isEligibleAddress", () => {
  it("accepts account and contract meta types", () => {
    assert.equal(
      isEligibleAddress(
        "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM",
        "account",
      ),
      true,
    );
    assert.equal(
      isEligibleAddress(
        "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
        "contract",
      ),
      true,
    );
  });

  it("rejects empty ids", () => {
    assert.equal(isEligibleAddress(undefined), false);
    assert.equal(isEligibleAddress(""), false);
  });
});

describe("copyText", () => {
  const account =
    "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";
  const contract =
    "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2";

  it("copies the full canonical account address", async () => {
    let written = "";
    const result = await copyText(account, {
      clipboard: {
        writeText: async (value: string) => {
          written = value;
        },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(written, account);
    assert.notEqual(written, truncateAddress(account));
  });

  it("copies the full canonical contract address", async () => {
    let written = "";
    const result = await copyText(contract, {
      clipboard: {
        writeText: async (value: string) => {
          written = value;
        },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(written, contract);
    assert.notEqual(written, truncateAddress(contract));
  });

  it("does not write a truncated display string", async () => {
    const truncated = truncateAddress(account);
    let written = "";
    await copyText(account, {
      clipboard: {
        writeText: async (value: string) => {
          written = value;
        },
      },
    });
    assert.equal(written.includes("..."), false);
    assert.notEqual(written, truncated);
  });

  it("reports failure when clipboard APIs are unavailable", async () => {
    const result = await copyText(account, {
      clipboard: null,
      document: undefined,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "unavailable");
    }
  });

  it("falls back after clipboard writeText rejection", async () => {
    const calls: string[] = [];
    const fakeDoc = {
      body: {
        appendChild(node: { value?: string }) {
          calls.push(`append:${node.value ?? ""}`);
        },
        removeChild() {
          calls.push("remove");
        },
      },
      createElement() {
        return {
          value: "",
          style: {} as Record<string, string>,
          setAttribute() {},
          focus() {},
          select() {},
          setSelectionRange() {},
        };
      },
      execCommand(command: string) {
        calls.push(command);
        return command === "copy";
      },
    } as unknown as Document;

    const result = await copyText(account, {
      clipboard: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      document: fakeDoc,
    });

    assert.equal(result.ok, true);
    assert.ok(calls.includes("copy"));
    assert.ok(calls.some((entry) => entry === `append:${account}`));
  });
});
