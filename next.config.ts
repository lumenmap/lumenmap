import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/http/security-headers";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        source: "/((?!embed(?:/|$)).*)",
        headers: buildSecurityHeaders({ pathname: "/" }),
      },
      {
        source: "/embed/:path*",
        headers: buildSecurityHeaders({
          pathname: "/embed",
          embedFrameAncestors: process.env.EMBED_FRAME_ANCESTORS,
        }),
      },
    ];
  },
};

export default nextConfig;
