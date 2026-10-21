"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { SorobanFeePanelView } from "@/components/dashboard/SorobanFeePanelView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Period } from "@/lib/types";
import type { SorobanFeeAnalytics } from "@/lib/soroban-fees/types";

function unavailableResult(
  period: Period,
  message: string,
): SorobanFeeAnalytics {
  return {
    status: "unavailable",
    source: "hubble",
    period,
    start: "",
    end: "",
    reason: "query_failed",
    message,
  };
}

async function fetchSorobanFees(period: Period): Promise<SorobanFeeAnalytics> {
  try {
    const response = await fetch(`/api/soroban-fees?period=${period}`);
    const body = (await response.json().catch(() => null)) as
      | SorobanFeeAnalytics
      | { message?: string }
      | null;
    if (
      body &&
      "status" in body &&
      (body.status === "available" || body.status === "unavailable")
    ) {
      return body;
    }
    return unavailableResult(
      period,
      "Soroban fee analytics could not be loaded for this period.",
    );
  } catch {
    return unavailableResult(
      period,
      "Soroban fee analytics could not be loaded for this period.",
    );
  }
}

export function SorobanFeePanel() {
  const { period } = useDashboard();
  const query = useQuery({
    queryKey: ["soroban-fees", period],
    queryFn: () => fetchSorobanFees(period),
    retry: false,
  });

  if (query.isLoading || !query.data) {
    return (
      <Card data-testid="soroban-fee-panel">
        <CardHeader>
          <CardTitle>Soroban fees and resources</CardTitle>
        </CardHeader>
        <CardContent>
          <p data-testid="soroban-fee-loading" className="text-sm text-zinc-400">
            Loading Soroban fee analytics…
          </p>
        </CardContent>
      </Card>
    );
  }

  return <SorobanFeePanelView result={query.data} />;
}
