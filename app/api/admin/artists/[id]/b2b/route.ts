import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { getSupabaseAdminClient } from "@/lib/supabase";

const GRADES = new Set(["unknown", "safe", "normal", "caution"]);

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      strengths?: string;
      cautions?: string;
      brand_safety_grade?: string | null;
      brand_category_ids?: string[];
    };
    const grade = body.brand_safety_grade ?? "unknown";
    if (!GRADES.has(grade)) {
      return NextResponse.json({ message: "브랜드 세이프티 등급이 올바르지 않습니다." }, { status: 400 });
    }
    const categoryIds = Array.from(
      new Set((body.brand_category_ids ?? []).filter((value) => typeof value === "string" && value))
    );
    const supabase = getSupabaseAdminClient() as any;

    if (categoryIds.length > 0) {
      const { data: categories, error: categoryError } = await supabase
        .from("brand_categories")
        .select("id")
        .in("id", categoryIds);
      if (categoryError) throw categoryError;
      if ((categories ?? []).length !== categoryIds.length) {
        return NextResponse.json({ message: "존재하지 않는 브랜드 카테고리가 있습니다." }, { status: 400 });
      }
    }

    const { error } = await supabase.rpc("admin_replace_artist_b2b_profile", {
      p_artist_id: params.id,
      p_strengths: body.strengths?.trim() ?? "",
      p_cautions: body.cautions?.trim() ?? "",
      p_brand_safety_grade: grade,
      p_brand_category_ids: categoryIds
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "B2B 분석 저장에 실패했습니다.") },
      { status: 500 }
    );
  }
}
