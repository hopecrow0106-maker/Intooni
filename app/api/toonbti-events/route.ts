import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/api-error";
import {
  recordToonbtiEvent,
  TOONBTI_EVENT_TYPES,
  type ToonbtiEventType
} from "@/lib/server/toonbti";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      eventType?: string;
      testId?: string;
      resultCode?: string;
      questionId?: string;
      artistId?: string;
    };
    if (!TOONBTI_EVENT_TYPES.includes(payload.eventType as ToonbtiEventType)) {
      return NextResponse.json({ message: "지원하지 않는 이벤트입니다." }, { status: 400 });
    }
    await recordToonbtiEvent({
      eventType: payload.eventType as ToonbtiEventType,
      testId: payload.testId,
      resultCode: payload.resultCode,
      questionId: payload.questionId,
      artistId: payload.artistId
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "이벤트 기록에 실패했습니다.") },
      { status: 500 }
    );
  }
}
