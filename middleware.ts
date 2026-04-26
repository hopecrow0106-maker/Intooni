import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedAdminRoute =
    pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (!isProtectedAdminRoute) {
    return NextResponse.next();
  }

  if (request.cookies.get(ADMIN_COOKIE_NAME)?.value !== "authenticated") {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
