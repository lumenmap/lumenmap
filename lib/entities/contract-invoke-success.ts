export interface RawContractInvokeOutcomeRow {
  contract_id?: unknown;
  successful_count?: unknown;
  failed_count?: unknown;
}

export type ContractInvokeSuccessResult =
  | {
      status: "available";
      contractId: string;
      successfulCount: number;
      failedCount: number;
      totalCount: number;
      successRatePercent: number;
      failureRatePercent: number;
      accessibleSummary: string;
    }
  | {
      status: "unavailable";
      contractId: string;
      reason: "schema_drift" | "no_data";
      accessibleSummary: string;
    };

function parseCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

export function mapContractInvokeOutcomeRow(
  contractId: string,
  row: RawContractInvokeOutcomeRow | null | undefined,
): ContractInvokeSuccessResult {
  if (!row || typeof row !== "object") {
    return {
      status: "unavailable",
      contractId,
      reason: "no_data",
      accessibleSummary:
        "Unavailable — Soroban invoke success/failure split is not available for this contract in the selected period.",
    };
  }

  const successful = parseCount(row.successful_count);
  const failed = parseCount(row.failed_count);
  if (successful === null || failed === null) {
    return {
      status: "unavailable",
      contractId,
      reason: "schema_drift",
      accessibleSummary:
        "Unavailable — Hubble invoke outcome columns are missing or null.",
    };
  }

  const total = successful + failed;
  if (total === 0) {
    return {
      status: "unavailable",
      contractId,
      reason: "no_data",
      accessibleSummary:
        "Unavailable — zero recorded invokes for this contract in the selected period.",
    };
  }

  const successRatePercent = Number(((successful / total) * 100).toFixed(1));
  const failureRatePercent = Number((100 - successRatePercent).toFixed(1));

  return {
    status: "available",
    contractId,
    successfulCount: successful,
    failedCount: failed,
    totalCount: total,
    successRatePercent,
    failureRatePercent,
    accessibleSummary: `${successRatePercent.toFixed(1)}% succeeded (${successful.toLocaleString("en-US")} succeeded · ${failed.toLocaleString("en-US")} failed of ${total.toLocaleString("en-US")} invokes)`,
  };
}

export async function loadContractInvokeSuccess(
  contractId: string,
  runner?: () => Promise<RawContractInvokeOutcomeRow | null>,
): Promise<ContractInvokeSuccessResult> {
  if (!runner) {
    return getFixtureContractInvokeSuccess(contractId);
  }
  try {
    const row = await runner();
    return mapContractInvokeOutcomeRow(contractId, row);
  } catch {
    return {
      status: "unavailable",
      contractId,
      reason: "schema_drift",
      accessibleSummary:
        "Unavailable — Hubble invoke outcome query failed or drifted.",
    };
  }
}

export function getFixtureContractInvokeSuccess(
  contractId: string,
): ContractInvokeSuccessResult {
  return mapContractInvokeOutcomeRow(contractId, {
    contract_id: contractId,
    successful_count: 4_910,
    failed_count: 90,
  });
}
