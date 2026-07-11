import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isProductionDeployment } from "@/lib/site";

const CANONICAL_HOST = "intooni.com";
const REDIRECT_HOSTS = new Set(["www.intooni.com", "intooni.vercel.app"]);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  if (host && REDIRECT_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.protocol = "https";
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  const response = NextResponse.next();

  if (!isProductionDeployment()) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|apple-touch-icon.png).*)"]
};
