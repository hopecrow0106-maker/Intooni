import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function GET() {
  const cookieValue = cookies().get(ADMIN_COOKIE_NAME)?.value;

  return NextResponse.json({
    authenticated: cookieValue === "authenticated"
  });
}
