import { NextResponse } from "next/server";

import { listPublicArtists } from "@/lib/server/public-artists";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const artists = await listPublicArtists();
    return NextResponse.json({ artists });
  } catch {
    return NextResponse.json(
      { message: "공개 작가 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
