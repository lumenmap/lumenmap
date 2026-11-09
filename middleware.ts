import { NextResponse, type NextRequest } from "next/server";
import {
  buildSecurityHeaders,
  isEmbedPathname,
} from "@/lib/http/security-headers";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next();
  const entries = buildSecurityHeaders({
    pathname,
    embedFrameAncestors: process.env.EMBED_FRAME_ANCESTORS,
  });

  for (const entry of entries) {
    response.headers.set(entry.key, entry.value);
  }

  if (isEmbedPathname(pathname)) {
    response.headers.delete("X-Frame-Options");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
