import { NextResponse } from "next/server";

import { getPublicArtistByHandle } from "@/lib/server/public-artists";

type PublicArtistRouteProps = {
  params: {
    handle: string;
  };
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: PublicArtistRouteProps) {
  try {
    const artist = await getPublicArtistByHandle(params.handle);
    if (!artist) {
      return NextResponse.json({ message: "작가를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ artist });
  } catch {
    return NextResponse.json(
      { message: "공개 작가 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
