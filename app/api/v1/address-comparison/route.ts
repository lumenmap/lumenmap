import { NextResponse } from "next/server";
import { getAddressProfile } from "@/lib/address-comparison-data";
import { validateComparisonAddresses } from "@/lib/address-comparison";
import { isDashboardNetworkId, resolveDashboardNetwork } from "@/lib/network";
import { isValidPeriod } from "@/lib/periods";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function handleAddressComparisonRequest(
  request: Request,
  getProfile: typeof getAddressProfile = getAddressProfile,
) {
  const limited = enforceRateLimit(request, "v1");
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const period = params.get("period") ?? "1d";
  const networkParam = params.get("network");
  if (!isValidPeriod(period)) {
    return NextResponse.json({ message: "Unsupported comparison period." }, { status: 400 });
  }
  if (networkParam !== null && !isDashboardNetworkId(networkParam)) {
    return NextResponse.json({ message: "Unsupported network." }, { status: 400 });
  }
  const validated = validateComparisonAddresses(params.get("a") ?? "", params.get("b") ?? "");
  if (!validated.ok) {
    return NextResponse.json({ message: validated.error }, { status: 400 });
  }
  const network = resolveDashboardNetwork(networkParam);
  const pair: [string, string] = [
    (params.get("a") ?? "").trim(),
    (params.get("b") ?? "").trim(),
  ];
  try {
    const [a, b] = await Promise.all(pair.map((address) => getProfile(address, period, network)));
    return NextResponse.json({ period, network, a, b }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch {
    return NextResponse.json({ message: "Address comparison is unavailable." }, { status: 500 });
  }
}

export const GET = (request: Request) => handleAddressComparisonRequest(request);
