export interface InvokeOutcomeSummary {
  totalInvokes: number;
  successfulInvokes: number;
  failedInvokes: number;
  successRatePercent: number;
  failureRatePercent: number;
  status: "ok" | "unavailable";
}

export function computeInvokeOutcomeSummary(input: {
  successfulInvokes?: number | null;
  failedInvokes?: number | null;
  totalInvokes?: number | null;
}): InvokeOutcomeSummary {
  const hasExplicitCounts =
    typeof input.successfulInvokes === "number" ||
    typeof input.failedInvokes === "number" ||
    typeof input.totalInvokes === "number";

  if (!hasExplicitCounts) {
    return {
      totalInvokes: 0,
      successfulInvokes: 0,
      failedInvokes: 0,
      successRatePercent: 0,
      failureRatePercent: 0,
      status: "unavailable",
    };
  }

  const failed = Math.max(0, Math.floor(Number(input.failedInvokes ?? 0) || 0));
  const rawSuccess =
    input.successfulInvokes !== undefined && input.successfulInvokes !== null
      ? Math.max(0, Math.floor(Number(input.successfulInvokes) || 0))
      : Math.max(
          0,
          Math.floor(Number(input.totalInvokes ?? 0) || 0) - failed,
        );
  const total = Math.max(
    rawSuccess + failed,
    Math.floor(Number(input.totalInvokes ?? 0) || 0),
  );

  if (total <= 0) {
    return {
      totalInvokes: 0,
      successfulInvokes: 0,
      failedInvokes: 0,
      successRatePercent: 0,
      failureRatePercent: 0,
      status: "unavailable",
    };
  }

  const boundedSuccess = Math.min(total, rawSuccess);
  const boundedFailed = Math.max(0, total - boundedSuccess);
  const successRatePercent = Number(
    ((boundedSuccess / total) * 100).toFixed(2),
  );
  const failureRatePercent = Number(
    ((boundedFailed / total) * 100).toFixed(2),
  );

  return {
    totalInvokes: total,
    successfulInvokes: boundedSuccess,
    failedInvokes: boundedFailed,
    successRatePercent,
    failureRatePercent,
    status: "ok",
  };
}

export function resolveContractInvokeOutcomes(
  nodeMeta?: {
    opCount?: number;
    successfulInvokes?: number;
    failedInvokes?: number;
  },
  functionBreakdownTotal = 0,
): InvokeOutcomeSummary {
  const fallbackTotal =
    nodeMeta?.opCount && nodeMeta.opCount > 0
      ? nodeMeta.opCount
      : functionBreakdownTotal > 0
        ? functionBreakdownTotal
        : undefined;

  return computeInvokeOutcomeSummary({
    successfulInvokes: nodeMeta?.successfulInvokes,
    failedInvokes: nodeMeta?.failedInvokes,
    totalInvokes: fallbackTotal,
  });
}
