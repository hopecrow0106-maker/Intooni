import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  checkLoginRateLimit,
  clearLoginAttempts,
  getAdminPassword,
  getClientIp,
  recordFailedLoginAttempt
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkLoginRateLimit(ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    const { password } = (await request.json()) as { password?: string };

    if (!password) {
      return NextResponse.json(
        { message: "비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    if (password !== getAdminPassword()) {
      recordFailedLoginAttempt(ip);
      return NextResponse.json(
        { message: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    clearLoginAttempts(ip);

    cookies().set({
      name: ADMIN_COOKIE_NAME,
      value: "authenticated",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "로그인 처리 중 오류가 발생했습니다."
      },
      { status: 500 }
    );
  }
}
