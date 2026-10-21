import { NextResponse, type NextRequest } from "next/server";
import { buildEmbedFramePolicy } from "@/lib/embed";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/embed")) {
    return NextResponse.next();
  }

  const policy = buildEmbedFramePolicy(process.env.EMBED_FRAME_ANCESTORS);
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", policy.contentSecurityPolicy);
  response.headers.delete("X-Frame-Options");
  return response;
}

export const config = {
  matcher: ["/embed/:path*"],
};
