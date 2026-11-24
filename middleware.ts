import { NextResponse, type NextRequest } from "next/server";
import { buildEmbedFramePolicy } from "@/lib/embed";
import { buildSecurityHeaders } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const isEmbed = request.nextUrl.pathname.startsWith("/embed");
  const frameAncestors = isEmbed
    ? buildEmbedFramePolicy(process.env.EMBED_FRAME_ANCESTORS).contentSecurityPolicy
    : undefined;

  const response = NextResponse.next();
  const headers = buildSecurityHeaders({
    frameAncestors,
    isDev: process.env.NODE_ENV === "development",
  });
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  if (isEmbed) {
    response.headers.delete("X-Frame-Options");
  } else {
    response.headers.set("X-Frame-Options", "DENY");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
