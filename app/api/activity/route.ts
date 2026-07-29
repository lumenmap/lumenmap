import { NextResponse } from "next/server";
import { getActivityData } from "@/lib/hubble/activity";
import { hasBigQueryCredentials } from "@/lib/hubble/client";
import { fixtureResponse } from "@/lib/hubble/fixture";
import { isValidPeriod } from "@/lib/periods";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period");
  const period = isValidPeriod(periodParam) ? periodParam : "1d";

  // Fixture mode: no credentials configured, return static sample data so the
  // dashboard is usable without a GCP project.
  if (!hasBigQueryCredentials()) {
    return NextResponse.json({ ...fixtureResponse, period, fixture: true });
  }

  try {
    const data = await getActivityData(period);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch activity data";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
