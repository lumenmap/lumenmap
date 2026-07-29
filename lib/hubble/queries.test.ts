import { describe, it, expect } from "vitest";
import {
  mapCategoryRows,
  mapContractRows,
  mapAccountRows,
  mapSorobanFunctionRows,
  mapSorobanFunctionContractRows,
  mapAccountMetadataRows,
  mapTransactionCountRows,
} from "@/lib/hubble/queries";

describe("mapCategoryRows", () => {
  it("should map category rows correctly", () => {
    const input = [
      { type_string: "payment", op_count: 100 },
      { type_string: "invoke_host_function", op_count: 50 },
    ];

    const result = mapCategoryRows(input);

    expect(result).toEqual([
      { type_string: "payment", op_count: 100 },
      { type_string: "invoke_host_function", op_count: 50 },
    ]);
  });

  it("should handle empty array", () => {
    expect(mapCategoryRows([])).toEqual([]);
  });
});

describe("mapContractRows", () => {
  it("should map contract rows correctly", () => {
    const input = [
      { contract_id: "CA123", op_count: 200 },
      { contract_id: "CA456", op_count: 150 },
    ];

    const result = mapContractRows(input);

    expect(result).toEqual([
      { contract_id: "CA123", op_count: 200 },
      { contract_id: "CA456", op_count: 150 },
    ]);
  });

  it("should handle empty array", () => {
    expect(mapContractRows([])).toEqual([]);
  });
});

describe("mapAccountRows", () => {
  it("should map account rows correctly", () => {
    const input = [
      { account_id: "GABC123", type_string: "payment", op_count: 75 },
      { account_id: "GDEF456", type_string: "change_trust", op_count: 25 },
    ];

    const result = mapAccountRows(input);

    expect(result).toEqual([
      { account_id: "GABC123", type_string: "payment", op_count: 75 },
      { account_id: "GDEF456", type_string: "change_trust", op_count: 25 },
    ]);
  });

  it("should handle empty array", () => {
    expect(mapAccountRows([])).toEqual([]);
  });
});

describe("mapSorobanFunctionRows", () => {
  it("should map soroban function rows correctly", () => {
    const input = [
      { function_name: "swap", op_count: 500 },
      { function_name: "transfer", op_count: 300 },
    ];

    const result = mapSorobanFunctionRows(input);

    expect(result).toEqual([
      { function_name: "swap", op_count: 500 },
      { function_name: "transfer", op_count: 300 },
    ]);
  });

  it("should handle empty array", () => {
    expect(mapSorobanFunctionRows([])).toEqual([]);
  });
});

describe("mapSorobanFunctionContractRows", () => {
  it("should map soroban function contract rows correctly", () => {
    const input = [
      { function_name: "swap", contract_id: "CA123", op_count: 400 },
      { function_name: "transfer", contract_id: "CA456", op_count: 250 },
    ];

    const result = mapSorobanFunctionContractRows(input);

    expect(result).toEqual([
      { function_name: "swap", contract_id: "CA123", op_count: 400 },
      { function_name: "transfer", contract_id: "CA456", op_count: 250 },
    ]);
  });

  it("should handle empty array", () => {
    expect(mapSorobanFunctionContractRows([])).toEqual([]);
  });
});

describe("mapAccountMetadataRows", () => {
  it("should map account metadata rows correctly", () => {
    const input = [
      { account_id: "GABC123", home_domain: "example.com" },
      { account_id: "GDEF456", home_domain: "stellar.org" },
    ];

    const result = mapAccountMetadataRows(input);

    expect(result).toEqual([
      { account_id: "GABC123", home_domain: "example.com" },
      { account_id: "GDEF456", home_domain: "stellar.org" },
    ]);
  });

  it("should handle empty array", () => {
    expect(mapAccountMetadataRows([])).toEqual([]);
  });
});

describe("mapTransactionCountRows", () => {
  it("should map transaction count with single row", () => {
    const input = [{ transaction_count: 12345 }];

    const result = mapTransactionCountRows(input);

    expect(result).toEqual([{ transaction_count: 12345 }]);
  });

  it("should return zero for empty array", () => {
    const result = mapTransactionCountRows([]);

    expect(result).toEqual([{ transaction_count: 0 }]);
  });

  it("should handle zero count", () => {
    const input = [{ transaction_count: 0 }];

    const result = mapTransactionCountRows(input);

    expect(result).toEqual([{ transaction_count: 0 }]);
  });

  it("should convert non-numeric values to 0", () => {
    const input = [{ transaction_count: null }];

    const result = mapTransactionCountRows(input);

    expect(result).toEqual([{ transaction_count: 0 }]);
  });

  it("should handle large transaction counts", () => {
    const input = [{ transaction_count: 999999999 }];

    const result = mapTransactionCountRows(input);

    expect(result).toEqual([{ transaction_count: 999999999 }]);
  });

  it("should handle string numbers and convert them", () => {
    const input = [{ transaction_count: "54321" }];

    const result = mapTransactionCountRows(input);

    expect(result).toEqual([{ transaction_count: 54321 }]);
  });
});
