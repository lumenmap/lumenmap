import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "@/lib/http/cache-headers";
import { parseActivityPeriod } from "@/app/api/activity/_handler";
import { resolvePeriod } from "@/lib/periods";
import { loadSorobanFeeAnalytics } from "@/lib/soroban-fees/query";
import type { SorobanFeeUnavailable } from "@/lib/soroban-fees/types";

export const dynamic = "force-dynamic";

function failedBody(
  period: "1d" | "7d" | "30d" | "month",
): SorobanFeeUnavailable {
  const range = resolvePeriod(period);
  return {
    status: "unavailable",
    source: "hubble",
    period,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    reason: "query_failed",
    message:
      "Soroban fee analytics could not be loaded for this period. The rest of the dashboard is unaffected.",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseActivityPeriod(url.searchParams.get("period"));
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, {
      status: parsed.status,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const body = await loadSorobanFeeAnalytics({ period: parsed.period });
    return NextResponse.json(body, { status: 200, headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json(failedBody(parsed.period), {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  }
}
