import { NextResponse } from "next/server";
import { parseActivityPeriod } from "@/app/api/activity/_handler";
import { NO_STORE_HEADERS } from "@/lib/http/cache-headers";
import { loadFeePressure } from "@/lib/network-fee-pressure";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseActivityPeriod(url.searchParams.get("period"));
  if (!parsed.ok) return NextResponse.json(parsed.body, { status: parsed.status, headers: NO_STORE_HEADERS });
  try {
    const body = await loadFeePressure({
      period: parsed.period,
      network: url.searchParams.get("network") === "testnet" ? "testnet" : "mainnet",
    });
    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ period: parsed.period, granularity: parsed.period === "1d" ? "hour" : "day", classic: null, soroban: null, source: "hubble" }, { headers: NO_STORE_HEADERS });
  }
}
