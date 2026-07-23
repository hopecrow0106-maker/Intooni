import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { isInstagramPostUrl, isNonNegativeInteger } from "@/lib/domain/admin-artist-details";
import { getSupabaseAdminClient } from "@/lib/supabase";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function nullableCount(value: unknown) {
  return value === null || value === undefined ? null : value;
}

function legacyDateParts(date: string) {
  const match = /^(\d{2}|\d{4})(?:[.\/-](\d{1,2}))?/.exec(date);
  if (!match) return { year: new Date().getFullYear(), month: null };

  const parsedYear = Number(match[1]);
  return {
    year: parsedYear < 100 ? 2000 + parsedYear : parsedYear,
    month: match[2] ? Number(match[2]) : null
  };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) return unauthorized();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const brandName = typeof body.brand_name === "string" ? body.brand_name.trim() : "";
    const brandIndustry = typeof body.brand_industry === "string" ? body.brand_industry.trim() : "";
    const suppliedDate = typeof body.collaboration_date === "string" ? body.collaboration_date.trim() : "";
    const legacyYear = isNonNegativeInteger(body.collaboration_year) ? body.collaboration_year : null;
    const legacyMonth = isNonNegativeInteger(body.collaboration_month) ? body.collaboration_month : null;
    const collaborationDate = suppliedDate || (legacyYear
      ? `${String(legacyYear).slice(-2)}${legacyMonth ? `.${String(legacyMonth).padStart(2, "0")}` : ""}`
      : "");
    const postUrl = typeof body.post_url === "string" ? body.post_url.trim() : "";
    const contentSummary = typeof body.content_summary === "string" ? body.content_summary.trim() : "";
    const counts = [nullableCount(body.likes), nullableCount(body.comments)];

    if (!brandName) return NextResponse.json({ message: "브랜드명은 필수입니다." }, { status: 400 });
    if (!postUrl || !isInstagramPostUrl(postUrl)) {
      return NextResponse.json({ message: "Instagram 게시물 URL이 필요합니다." }, { status: 400 });
    }
    if (brandIndustry.length > 100) {
      return NextResponse.json({ message: "브랜드 업종은 100글자 이내로 입력해 주세요." }, { status: 400 });
    }
    if (!collaborationDate || collaborationDate.length > 40) {
      return NextResponse.json({ message: "협업 날짜를 입력해 주세요. 예: 26.07.01" }, { status: 400 });
    }
    if (contentSummary.length > 2000) {
      return NextResponse.json({ message: "협업 내용은 2,000자 이하여야 합니다." }, { status: 400 });
    }
    if (!counts.every((value) => value === null || isNonNegativeInteger(value))) {
      return NextResponse.json({ message: "좋아요와 댓글은 0 이상의 정수 또는 빈 값이어야 합니다." }, { status: 400 });
    }

    const legacyDate = legacyDateParts(collaborationDate);
    const payload = {
      artist_id: params.id,
      brand_name: brandName,
      brand_industry: brandIndustry,
      collaboration_date: collaborationDate,
      collaboration_year: legacyDate.year,
      collaboration_month: legacyDate.month,
      post_url: postUrl,
      content_summary: contentSummary,
      likes: counts[0],
      comments: counts[1],
      updated_at: new Date().toISOString()
    };
    const supabase = getSupabaseAdminClient();
    const query = typeof body.id === "string" && body.id
      ? supabase.from("artist_collaborations").update(payload).eq("artist_id", params.id).eq("id", body.id)
      : supabase.from("artist_collaborations").insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return NextResponse.json(data, { status: typeof body.id === "string" && body.id ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "협업 이력 저장에 실패했습니다.") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) return unauthorized();

  try {
    const { collaboration_id: collaborationId } = (await request.json()) as { collaboration_id?: string };
    if (!collaborationId) {
      return NextResponse.json({ message: "협업 이력 id가 필요합니다." }, { status: 400 });
    }
    const { error } = await getSupabaseAdminClient()
      .from("artist_collaborations")
      .delete()
      .eq("artist_id", params.id)
      .eq("id", collaborationId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "협업 이력 삭제에 실패했습니다.") },
      { status: 500 }
    );
  }
}
