import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { saveArtistToonbtiAssignment } from "@/lib/server/toonbti";

export async function PUT(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = (await request.json()) as {
      artistId?: string;
      testId?: string;
      resultTypeId?: string | null;
    };
    if (!payload.artistId || !payload.testId) {
      return NextResponse.json(
        { message: "작가와 테스트 ID가 필요합니다." },
        { status: 400 }
      );
    }
    const assignment = await saveArtistToonbtiAssignment({
      artistId: payload.artistId,
      testId: payload.testId,
      resultTypeId: payload.resultTypeId || null
    });
    return NextResponse.json({ assignment });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "작가 Toon-BTI 저장에 실패했습니다.") },
      { status: 400 }
    );
  }
}
