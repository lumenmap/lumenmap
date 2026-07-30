import { describe, expect, it } from "vitest";
import { buildActorTreemap } from "@/lib/entities/build-treemap";
import type {
  AccountRow,
  CategoryRow,
  ContractRow,
} from "@/lib/types";

function makeInput(overrides: {
  categories?: CategoryRow[];
  contracts?: ContractRow[];
  accounts?: AccountRow[];
}) {
  return {
    categories: overrides.categories ?? [],
    contracts: overrides.contracts ?? [],
    accounts: overrides.accounts ?? [],
    sorobanFunctions: [],
    sorobanFunctionContracts: [],
  };
}

function findGroup(root: ReturnType<typeof buildActorTreemap>, category: string) {
  const group = root.children?.find((node) => node.meta?.category === category);
  if (!group) {
    throw new Error(`Group "${category}" not found in treemap`);
  }
  return group;
}

function remainderNodes(children: ReturnType<typeof buildActorTreemap>["children"] = []) {
  return children.filter((node) => node.meta?.type === "remainder");
}

describe("buildActorTreemap remainder nodes", () => {
  it("adds exactly one remainder node when children are partially capped", () => {
    const input = makeInput({
      categories: [{ type_string: "payment", op_count: 100 }],
      accounts: [
        { account_id: "A", type_string: "payment", op_count: 40 },
        { account_id: "B", type_string: "payment", op_count: 20 },
      ],
    });

    const root = buildActorTreemap(input);
    const payments = findGroup(root, "payments");
    const remainders = remainderNodes(payments.children);

    expect(remainders).toHaveLength(1);
    expect(remainders[0].value).toBe(40);
    expect(remainders[0].meta?.remainder).toBe(true);
    expect(remainders[0].meta?.id).toBeUndefined();
    expect(remainders[0].children).toBeUndefined();

    const total = (payments.children ?? []).reduce(
      (sum, node) => sum + (node.value ?? 0),
      0,
    );
    expect(total).toBe(payments.value);
  });

  it("adds no remainder node when listed accounts already cover the total", () => {
    const input = makeInput({
      categories: [{ type_string: "payment", op_count: 100 }],
      accounts: [{ account_id: "A", type_string: "payment", op_count: 100 }],
    });

    const root = buildActorTreemap(input);
    const payments = findGroup(root, "payments");

    expect(remainderNodes(payments.children)).toHaveLength(0);
  });

  it("adds no remainder node for groups that fall back to exact type leaves", () => {
    // "set_options" isn't in ACCOUNT_QUERY_TYPES, so it always falls back
    // to buildTypeLeaves, which is exact by construction.
    const input = makeInput({
      categories: [{ type_string: "set_options", op_count: 25 }],
    });

    const root = buildActorTreemap(input);
    const account = findGroup(root, "account");

    expect(remainderNodes(account.children)).toHaveLength(0);
    expect(account.value).toBe(25);
  });

  it("throws instead of rendering when listed children exceed the parent total", () => {
    const input = makeInput({
      categories: [{ type_string: "payment", op_count: 50 }],
      accounts: [
        { account_id: "A", type_string: "payment", op_count: 40 },
        { account_id: "B", type_string: "payment", op_count: 40 },
      ],
    });

    expect(() => buildActorTreemap(input)).toThrow(/invariant violated/i);
  });

  it("reconciles the soroban group's contract remainder", () => {
    const input = makeInput({
      categories: [{ type_string: "invoke_host_function", op_count: 500 }],
      contracts: [
        { contract_id: "C1", op_count: 300 },
        { contract_id: "C2", op_count: 150 },
      ],
    });

    const root = buildActorTreemap(input);
    const soroban = findGroup(root, "soroban");
    const remainders = remainderNodes(soroban.children);

    expect(remainders).toHaveLength(1);
    expect(remainders[0].value).toBe(50);
  });
});