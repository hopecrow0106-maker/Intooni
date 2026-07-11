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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) return unauthorized();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const brandName = typeof body.brand_name === "string" ? body.brand_name.trim() : "";
    const postUrl = typeof body.post_url === "string" ? body.post_url.trim() : "";
    const contentSummary =
      typeof body.content_summary === "string" ? body.content_summary.trim() : "";
    const year = body.collaboration_year;
    const month = body.collaboration_month;
    const rawGrade = body.ad_disclosure_status ?? "unknown";
    const counts = [nullableCount(body.likes), nullableCount(body.comments), nullableCount(body.views)];

    if (!brandName) return NextResponse.json({ message: "브랜드명이 필요합니다." }, { status: 400 });
    if (!postUrl || !isInstagramPostUrl(postUrl)) {
      return NextResponse.json({ message: "Instagram 게시물 URL이 필요합니다." }, { status: 400 });
    }
    if (contentSummary.length > 2000) {
      return NextResponse.json({ message: "협업 내용은 2,000자 이하여야 합니다." }, { status: 400 });
    }
    if (!isNonNegativeInteger(year) || year < 2000) {
      return NextResponse.json({ message: "협업 연도는 2000 이상 정수여야 합니다." }, { status: 400 });
    }
    if (month !== null && (!isNonNegativeInteger(month) || month < 1 || month > 12)) {
      return NextResponse.json({ message: "협업 월은 1~12 또는 비워야 합니다." }, { status: 400 });
    }
    if (!counts.every((value) => value === null || isNonNegativeInteger(value))) {
      return NextResponse.json({ message: "반응 수는 0 이상의 정수 또는 빈 값이어야 합니다." }, { status: 400 });
    }
    if (rawGrade !== "yes" && rawGrade !== "no" && rawGrade !== "unknown") {
      return NextResponse.json({ message: "광고 표시 여부가 올바르지 않습니다." }, { status: 400 });
    }
    const grade: "yes" | "no" | "unknown" = rawGrade;

    const payload = {
      artist_id: params.id,
      brand_name: brandName,
      brand_category_id:
        typeof body.brand_category_id === "string" && body.brand_category_id ? body.brand_category_id : null,
      collaboration_year: year,
      collaboration_month: month ?? null,
      post_url: postUrl,
      content_summary: contentSummary,
      ad_disclosure_status: grade,
      likes: counts[0],
      comments: counts[1],
      views: counts[2],
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
    const { collaboration_id: collaborationId } = (await request.json()) as {
      collaboration_id?: string;
    };
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
