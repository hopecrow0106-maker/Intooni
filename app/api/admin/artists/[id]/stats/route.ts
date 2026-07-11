import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { isIsoDate, isNonNegativeInteger } from "@/lib/domain/admin-artist-details";
import { getSupabaseAdminClient } from "@/lib/supabase";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) return unauthorized();

  try {
    const body = (await request.json()) as {
      recorded_date?: string;
      followers?: number;
      post_count?: number;
    };
    if (!body.recorded_date || !isIsoDate(body.recorded_date)) {
      return NextResponse.json({ message: "기록일은 YYYY-MM-DD 형식이어야 합니다." }, { status: 400 });
    }
    if (!isNonNegativeInteger(body.followers) || !isNonNegativeInteger(body.post_count)) {
      return NextResponse.json({ message: "팔로워와 게시물 수는 0 이상의 정수여야 합니다." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("artist_stats")
      .upsert(
        {
          artist_id: params.id,
          recorded_date: body.recorded_date,
          followers: body.followers,
          post_count: body.post_count,
          updated_at: new Date().toISOString()
        },
        { onConflict: "artist_id,recorded_date" }
      )
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "통계 기록 저장에 실패했습니다.") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) return unauthorized();

  try {
    const { stat_id: statId } = (await request.json()) as { stat_id?: string };
    if (!statId) return NextResponse.json({ message: "통계 id가 필요합니다." }, { status: 400 });

    const { error } = await getSupabaseAdminClient()
      .from("artist_stats")
      .delete()
      .eq("artist_id", params.id)
      .eq("id", statId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "통계 기록 삭제에 실패했습니다.") },
      { status: 500 }
    );
  }
}
