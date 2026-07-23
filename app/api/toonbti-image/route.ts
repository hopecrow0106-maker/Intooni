import { NextResponse } from "next/server";

import { CANONICAL_SITE_URL } from "@/lib/site";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function allowedImageUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    const allowedHosts = new Set([new URL(CANONICAL_SITE_URL).host]);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) allowedHosts.add(new URL(supabaseUrl).host);
    if (!allowedHosts.has(url.host)) return null;
    if (
      url.host !== new URL(CANONICAL_SITE_URL).host &&
      !url.pathname.startsWith("/storage/v1/object/public/")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url") ?? "";
  const url = allowedImageUrl(rawUrl);
  if (!url) {
    return NextResponse.json({ message: "허용되지 않은 이미지 URL입니다." }, { status: 400 });
  }

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) {
    return NextResponse.json({ message: "이미지를 불러오지 못했습니다." }, { status: 502 });
  }
  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (!contentType.startsWith("image/") || contentLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ message: "지원하지 않는 이미지입니다." }, { status: 415 });
  }
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ message: "이미지 크기가 너무 큽니다." }, { status: 413 });
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
}
