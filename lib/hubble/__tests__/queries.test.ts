import assert from "node:assert";
import test from "node:test";
import { mapNativePaymentVolumeRow } from "../queries";

test("mapNativePaymentVolumeRow", async (t) => {
  await t.test("maps valid amount", () => {
    const result = mapNativePaymentVolumeRow([{ volume_xlm: "123.456" }]);
    assert.deepStrictEqual(result, { amount: "123.456", unit: "XLM" });
  });

  await t.test("maps null amount to 0", () => {
    const result = mapNativePaymentVolumeRow([{ volume_xlm: null }]);
    assert.deepStrictEqual(result, { amount: "0", unit: "XLM" });
  });

  await t.test("maps missing field to 0", () => {
    const result = mapNativePaymentVolumeRow([{}]);
    assert.deepStrictEqual(result, { amount: "0", unit: "XLM" });
  });

  await t.test("maps empty rows to 0", () => {
    const result = mapNativePaymentVolumeRow([]);
    assert.deepStrictEqual(result, { amount: "0", unit: "XLM" });
  });
});
