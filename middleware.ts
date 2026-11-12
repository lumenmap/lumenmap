import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isEmbed = pathname === "/embed" || pathname.startsWith("/embed/");
  const securityHeaders = buildSecurityHeaders({
    pathname,
    embedAllowlist: process.env.EMBED_FRAME_ANCESTORS,
  });

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  if (isEmbed) {
    response.headers.delete("X-Frame-Options");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
