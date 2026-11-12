import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security-headers";

const toHeaderList = (record: Record<string, string>) =>
  Object.entries(record).map(([key, value]) => ({ key, value }));

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  async headers() {
    const dashboardHeaders = toHeaderList(
      buildSecurityHeaders({ pathname: "/" }),
    );
    const embedHeaders = toHeaderList(
      buildSecurityHeaders({
        pathname: "/embed",
        embedAllowlist: process.env.EMBED_FRAME_ANCESTORS,
      }),
    );

    return [
      {
        source: "/embed",
        headers: embedHeaders,
      },
      {
        source: "/embed/:path*",
        headers: embedHeaders,
      },
      {
        source: "/((?!embed(?:/|$)).*)",
        headers: dashboardHeaders,
      },
    ];
  },
};

export default nextConfig;
