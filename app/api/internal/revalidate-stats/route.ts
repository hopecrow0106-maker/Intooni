import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/api-error";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" ? token : "";
}

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.COLLECTOR_REVALIDATE_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { message: "COLLECTOR_REVALIDATE_SECRET is not configured." },
        { status: 500 }
      );
    }

    const providedSecret = getBearerToken(request) || request.headers.get("x-collector-secret") || "";
    if (providedSecret !== expectedSecret) {
      return unauthorizedResponse();
    }

    const payload = (await request.json().catch(() => ({}))) as { handles?: string[] };
    const handles = Array.from(new Set((payload.handles ?? []).map((handle) => handle.trim()).filter(Boolean)));

    revalidatePath("/");
    revalidatePath("/sitemap.xml");

    for (const handle of handles.slice(0, 100)) {
      revalidatePath(`/artists/${encodeURIComponent(handle.replace(/^@/, ""))}`);
    }

    return NextResponse.json({
      success: true,
      revalidated: {
        home: true,
        sitemap: true,
        artists: handles.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "통계 캐시 재검증에 실패했습니다.") },
      { status: 500 }
    );
  }
}
