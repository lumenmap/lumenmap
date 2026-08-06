import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mapTransactionCategoryRows } from "./queries";

describe("mapTransactionCategoryRows", () => {
  test("maps txn_count values", () => {
    assert.deepEqual(
      mapTransactionCategoryRows([
        { type_string: "payment", txn_count: "12" },
        { type_string: "manage_sell_offer", txn_count: 4 },
      ]),
      [
        { type_string: "payment", txn_count: 12 },
        { type_string: "manage_sell_offer", txn_count: 4 },
      ],
    );
  });
});
