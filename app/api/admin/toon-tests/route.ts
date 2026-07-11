import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { getAdminToonTest, saveAdminToonTest } from "@/lib/server/toon-tests";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function isMissingToonTestsTable(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  return message.includes("toon_tests") && message.includes("schema cache");
}

export async function GET() {
  if (!isAdminAuthenticated()) return unauthorizedResponse();
  try {
    return NextResponse.json({ test: await getAdminToonTest(), storageAvailable: true });
  } catch (error) {
    if (isMissingToonTestsTable(error)) {
      return NextResponse.json({
        test: null,
        storageAvailable: false,
        message: "아직 ToonBTI 저장 테이블이 없어 저장·발행이 비활성화된 미리보기 모드로 열었습니다."
      });
    }

    return NextResponse.json(
      { message: getErrorMessage(error, "툰비티아이 테스트를 불러오지 못했습니다.") },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!isAdminAuthenticated()) return unauthorizedResponse();
  try {
    const payload = (await request.json()) as {
      title?: string;
      status?: "draft" | "published";
      draft?: unknown;
    };
    if (!payload.draft || !["draft", "published"].includes(payload.status ?? "")) {
      return NextResponse.json({ message: "draft와 status가 필요합니다." }, { status: 400 });
    }
    const test = await saveAdminToonTest({
      title: payload.title ?? "툰비티아이",
      status: payload.status as "draft" | "published",
      draft: payload.draft
    });
    return NextResponse.json({ test });
  } catch (error) {
    if (isMissingToonTestsTable(error)) {
      return NextResponse.json(
        { message: "ToonBTI 저장 테이블이 아직 준비되지 않았습니다." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: getErrorMessage(error, "툰비티아이 테스트 저장에 실패했습니다.") },
      { status: 400 }
    );
  }
}
