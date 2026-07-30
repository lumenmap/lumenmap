import { describe, it, expect } from "vitest";
import {
  mapCategoryRows,
  mapContractRows,
  mapAccountRows,
  mapSorobanFunctionRows,
  mapSorobanFunctionContractRows,
  mapAccountMetadataRows,
} from "@/lib/hubble/queries";

// ---------------------------------------------------------------------------
// mapCategoryRows
// ---------------------------------------------------------------------------
describe("mapCategoryRows", () => {
  it("maps valid rows correctly", () => {
    const rows = [
      { type_string: "payment", op_count: 100 },
      { type_string: "manage_buy_offer", op_count: 50 },
      { type_string: "invoke_host_function", op_count: 0 },
    ];
    expect(mapCategoryRows(rows)).toEqual([
      { type_string: "payment", op_count: 100 },
      { type_string: "manage_buy_offer", op_count: 50 },
      { type_string: "invoke_host_function", op_count: 0 },
    ]);
  });

  it("accepts empty type_string", () => {
    expect(mapCategoryRows([{ type_string: "", op_count: 5 }])).toEqual([
      { type_string: "", op_count: 5 },
    ]);
  });

  it("rejects null type_string", () => {
    expect(() => mapCategoryRows([{ type_string: null, op_count: 5 }])).toThrow(
      /type_string/,
    );
  });

  it("rejects NaN op_count", () => {
    expect(() =>
      mapCategoryRows([{ type_string: "payment", op_count: NaN }]),
    ).toThrow(/op_count/);
  });

  it("rejects Infinity op_count", () => {
    expect(() =>
      mapCategoryRows([{ type_string: "payment", op_count: Infinity }]),
    ).toThrow(/op_count/);
  });

  it("rejects negative Infinity op_count", () => {
    expect(() =>
      mapCategoryRows([{ type_string: "payment", op_count: -Infinity }]),
    ).toThrow(/op_count/);
  });

  it("rejects null op_count", () => {
    expect(() =>
      mapCategoryRows([{ type_string: "payment", op_count: null }]),
    ).toThrow(/op_count/);
  });

  it("rejects missing op_count field", () => {
    expect(() =>
      mapCategoryRows([{ type_string: "payment" }]),
    ).toThrow(/op_count/);
  });

  it("rejects missing type_string field", () => {
    expect(() =>
      mapCategoryRows([{ op_count: 5 }]),
    ).toThrow(/type_string/);
  });

  it("rejects undefined op_count", () => {
    expect(() =>
      mapCategoryRows([{ type_string: "payment", op_count: undefined }]),
    ).toThrow(/op_count/);
  });

  it("handles BigQuery numeric wrapper for op_count", () => {
    const rows = [
      { type_string: "payment", op_count: { value: 42 } },
    ];
    expect(mapCategoryRows(rows)).toEqual([
      { type_string: "payment", op_count: 42 },
    ]);
  });

  it("preserves large valid counts", () => {
    const large = 9_007_199_254_740_991;
    expect(
      mapCategoryRows([{ type_string: "payment", op_count: large }])[0]
        .op_count,
    ).toBe(large);
  });

  it("handles zero op_count", () => {
    expect(
      mapCategoryRows([{ type_string: "payment", op_count: 0 }])[0].op_count,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mapContractRows
// ---------------------------------------------------------------------------
describe("mapContractRows", () => {
  it("maps valid rows correctly", () => {
    const rows = [
      { contract_id: "CA123", op_count: 500 },
      { contract_id: "CB456", op_count: 300 },
    ];
    expect(mapContractRows(rows)).toEqual([
      { contract_id: "CA123", op_count: 500 },
      { contract_id: "CB456", op_count: 300 },
    ]);
  });

  it("rejects null contract_id", () => {
    expect(() =>
      mapContractRows([{ contract_id: null, op_count: 5 }]),
    ).toThrow(/contract_id/);
  });

  it("rejects empty contract_id", () => {
    expect(() =>
      mapContractRows([{ contract_id: "", op_count: 5 }]),
    ).toThrow(/contract_id/);
  });

  it("does not convert null identifier to string 'null'", () => {
    try {
      mapContractRows([{ contract_id: null, op_count: 5 }]);
    } catch (e) {
      expect((e as Error).message).not.toContain("string 'null'");
      expect((e as Error).message).toContain("contract_id");
    }
  });

  it("rejects NaN op_count", () => {
    expect(() =>
      mapContractRows([{ contract_id: "CA123", op_count: NaN }]),
    ).toThrow(/op_count/);
  });

  it("rejects missing contract_id field", () => {
    expect(() =>
      mapContractRows([{ op_count: 5 }]),
    ).toThrow(/contract_id/);
  });

  it("handles BigQuery numeric wrapper for op_count", () => {
    expect(
      mapContractRows([{ contract_id: "CA123", op_count: { value: 99 } }])[0]
        .op_count,
    ).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// mapAccountRows
// ---------------------------------------------------------------------------
describe("mapAccountRows", () => {
  it("maps valid rows correctly", () => {
    const rows = [
      { account_id: "GA5XIG", type_string: "payment", op_count: 200 },
      { account_id: "GB7YH", type_string: "manage_buy_offer", op_count: 150 },
    ];
    expect(mapAccountRows(rows)).toEqual([
      { account_id: "GA5XIG", type_string: "payment", op_count: 200 },
      { account_id: "GB7YH", type_string: "manage_buy_offer", op_count: 150 },
    ]);
  });

  it("rejects null account_id", () => {
    expect(() =>
      mapAccountRows([{ account_id: null, type_string: "payment", op_count: 5 }]),
    ).toThrow(/account_id/);
  });

  it("rejects empty account_id", () => {
    expect(() =>
      mapAccountRows([{ account_id: "", type_string: "payment", op_count: 5 }]),
    ).toThrow(/account_id/);
  });

  it("rejects missing account_id field", () => {
    expect(() =>
      mapAccountRows([{ type_string: "payment", op_count: 5 }]),
    ).toThrow(/account_id/);
  });

  it("rejects NaN op_count", () => {
    expect(() =>
      mapAccountRows([
        { account_id: "GA5XIG", type_string: "payment", op_count: NaN },
      ]),
    ).toThrow(/op_count/);
  });

  it("rejects Infinity op_count", () => {
    expect(() =>
      mapAccountRows([
        { account_id: "GA5XIG", type_string: "payment", op_count: Infinity },
      ]),
    ).toThrow(/op_count/);
  });

  it("accepts empty type_string", () => {
    const result = mapAccountRows([
      { account_id: "GA5XIG", type_string: "", op_count: 5 },
    ]);
    expect(result[0].type_string).toBe("");
  });

  it("handles BigQuery numeric wrapper for op_count", () => {
    const result = mapAccountRows([
      { account_id: "GA5XIG", type_string: "payment", op_count: { value: 77 } },
    ]);
    expect(result[0].op_count).toBe(77);
  });
});

// ---------------------------------------------------------------------------
// mapSorobanFunctionRows
// ---------------------------------------------------------------------------
describe("mapSorobanFunctionRows", () => {
  it("maps valid rows correctly", () => {
    const rows = [
      { function_name: "swap", op_count: 1000 },
      { function_name: "invoke", op_count: 500 },
    ];
    expect(mapSorobanFunctionRows(rows)).toEqual([
      { function_name: "swap", op_count: 1000 },
      { function_name: "invoke", op_count: 500 },
    ]);
  });

  it("accepts empty function_name", () => {
    const result = mapSorobanFunctionRows([
      { function_name: "", op_count: 5 },
    ]);
    expect(result[0].function_name).toBe("");
  });

  it("rejects null function_name", () => {
    expect(() =>
      mapSorobanFunctionRows([{ function_name: null, op_count: 5 }]),
    ).toThrow(/function_name/);
  });

  it("rejects NaN op_count", () => {
    expect(() =>
      mapSorobanFunctionRows([{ function_name: "swap", op_count: NaN }]),
    ).toThrow(/op_count/);
  });

  it("rejects missing function_name field", () => {
    expect(() =>
      mapSorobanFunctionRows([{ op_count: 5 }]),
    ).toThrow(/function_name/);
  });

  it("handles BigQuery numeric wrapper for op_count", () => {
    const result = mapSorobanFunctionRows([
      { function_name: "swap", op_count: { value: 333 } },
    ]);
    expect(result[0].op_count).toBe(333);
  });
});

// ---------------------------------------------------------------------------
// mapSorobanFunctionContractRows
// ---------------------------------------------------------------------------
describe("mapSorobanFunctionContractRows", () => {
  it("maps valid rows correctly", () => {
    const rows = [
      { function_name: "swap", contract_id: "CA123", op_count: 400 },
      { function_name: "swap", contract_id: "CB456", op_count: 300 },
    ];
    expect(mapSorobanFunctionContractRows(rows)).toEqual([
      { function_name: "swap", contract_id: "CA123", op_count: 400 },
      { function_name: "swap", contract_id: "CB456", op_count: 300 },
    ]);
  });

  it("rejects null contract_id", () => {
    expect(() =>
      mapSorobanFunctionContractRows([
        { function_name: "swap", contract_id: null, op_count: 5 },
      ]),
    ).toThrow(/contract_id/);
  });

  it("rejects empty contract_id", () => {
    expect(() =>
      mapSorobanFunctionContractRows([
        { function_name: "swap", contract_id: "", op_count: 5 },
      ]),
    ).toThrow(/contract_id/);
  });

  it("rejects missing contract_id field", () => {
    expect(() =>
      mapSorobanFunctionContractRows([
        { function_name: "swap", op_count: 5 },
      ]),
    ).toThrow(/contract_id/);
  });

  it("accepts empty function_name", () => {
    const result = mapSorobanFunctionContractRows([
      { function_name: "", contract_id: "CA123", op_count: 5 },
    ]);
    expect(result[0].function_name).toBe("");
  });

  it("rejects NaN op_count", () => {
    expect(() =>
      mapSorobanFunctionContractRows([
        { function_name: "swap", contract_id: "CA123", op_count: NaN },
      ]),
    ).toThrow(/op_count/);
  });

  it("handles BigQuery numeric wrapper for op_count", () => {
    const result = mapSorobanFunctionContractRows([
      { function_name: "swap", contract_id: "CA123", op_count: { value: 111 } },
    ]);
    expect(result[0].op_count).toBe(111);
  });

  it("does not convert null identifier to string 'null'", () => {
    try {
      mapSorobanFunctionContractRows([
        { function_name: "swap", contract_id: null, op_count: 5 },
      ]);
    } catch (e) {
      expect((e as Error).message).not.toContain("string 'null'");
      expect((e as Error).message).toContain("contract_id");
    }
  });
});

// ---------------------------------------------------------------------------
// mapAccountMetadataRows
// ---------------------------------------------------------------------------
describe("mapAccountMetadataRows", () => {
  it("maps valid rows correctly", () => {
    const rows = [
      { account_id: "GA5XIG", home_domain: "example.com" },
      { account_id: "GB7YH", home_domain: "test.org" },
    ];
    expect(mapAccountMetadataRows(rows)).toEqual([
      { account_id: "GA5XIG", home_domain: "example.com" },
      { account_id: "GB7YH", home_domain: "test.org" },
    ]);
  });

  it("rejects null account_id", () => {
    expect(() =>
      mapAccountMetadataRows([
        { account_id: null, home_domain: "example.com" },
      ]),
    ).toThrow(/account_id/);
  });

  it("rejects empty account_id", () => {
    expect(() =>
      mapAccountMetadataRows([{ account_id: "", home_domain: "example.com" }]),
    ).toThrow(/account_id/);
  });

  it("rejects missing account_id field", () => {
    expect(() =>
      mapAccountMetadataRows([{ home_domain: "example.com" }]),
    ).toThrow(/account_id/);
  });

  it("accepts empty home_domain", () => {
    const result = mapAccountMetadataRows([
      { account_id: "GA5XIG", home_domain: "" },
    ]);
    expect(result[0].home_domain).toBe("");
  });

  it("does not convert null account_id to string 'null'", () => {
    try {
      mapAccountMetadataRows([
        { account_id: null, home_domain: "example.com" },
      ]);
    } catch (e) {
      expect((e as Error).message).not.toContain("string 'null'");
      expect((e as Error).message).toContain("account_id");
    }
  });

  it("rejects null home_domain", () => {
    expect(() =>
      mapAccountMetadataRows([
        { account_id: "GA5XIG", home_domain: null },
      ]),
    ).toThrow(/home_domain/);
  });
});
