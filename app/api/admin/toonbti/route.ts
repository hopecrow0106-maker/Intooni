import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import {
  getAdminToonbtiData,
  saveAdminToonbtiConfig
} from "@/lib/server/toonbti";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function isMissingScoringSchema(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  return (
    message.includes("schema cache") &&
    [
      "toonbti_axes",
      "toonbti_traits",
      "toonbti_questions",
      "toonbti_question_options",
      "toonbti_result_types",
      "artist_toonbti_types"
    ].some((table) => message.includes(table))
  );
}

export async function GET() {
  if (!isAdminAuthenticated()) return unauthorizedResponse();
  try {
    return NextResponse.json({
      ...(await getAdminToonbtiData()),
      storageAvailable: true
    });
  } catch (error) {
    if (isMissingScoringSchema(error)) {
      return NextResponse.json({
        config: null,
        assignments: [],
        storageAvailable: false,
        message: "Toon-BTI 축·점수 마이그레이션 013을 먼저 적용해 주세요."
      });
    }
    return NextResponse.json(
      { message: getErrorMessage(error, "Toon-BTI 설정을 불러오지 못했습니다.") },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!isAdminAuthenticated()) return unauthorizedResponse();
  try {
    const payload = (await request.json()) as { config?: unknown };
    if (!payload.config) {
      return NextResponse.json({ message: "저장할 Toon-BTI 설정이 필요합니다." }, { status: 400 });
    }
    return NextResponse.json({ config: await saveAdminToonbtiConfig(payload.config) });
  } catch (error) {
    if (isMissingScoringSchema(error)) {
      return NextResponse.json(
        { message: "Toon-BTI 축·점수 마이그레이션 013을 먼저 적용해 주세요." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: getErrorMessage(error, "Toon-BTI 설정 저장에 실패했습니다.") },
      { status: 400 }
    );
  }
}
