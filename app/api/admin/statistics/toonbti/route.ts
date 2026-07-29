import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { buildAdminToonbtiAnalytics } from "@/lib/domain/admin-toonbti-analytics";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdminClient() as any;
    const { data: test, error: testError } = await supabase
      .from("toon_tests")
      .select("id")
      .eq("slug", "default")
      .maybeSingle();
    if (testError) throw testError;

    const artistsResult = await supabase.from("artists").select("id, status");
    if (artistsResult.error) throw artistsResult.error;

    if (!test) {
      return NextResponse.json({
        analytics: buildAdminToonbtiAnalytics(artistsResult.data ?? [], [], [], [], [])
      });
    }

    const [assignmentsResult, resultTypesResult, axesResult, traitsResult] = await Promise.all([
      supabase
        .from("artist_toonbti_types")
        .select("artist_id, result_type_id")
        .eq("test_id", test.id),
      supabase
        .from("toonbti_result_types")
        .select("id, code, name, position, is_active")
        .eq("test_id", test.id),
      supabase
        .from("toonbti_axes")
        .select("id, name, position, is_active")
        .eq("test_id", test.id),
      supabase
        .from("toonbti_traits")
        .select("axis_id, code, name, position, is_active")
        .eq("test_id", test.id)
    ]);

    for (const result of [assignmentsResult, resultTypesResult, axesResult, traitsResult]) {
      if (result.error) throw result.error;
    }

    return NextResponse.json({
      analytics: buildAdminToonbtiAnalytics(
        artistsResult.data ?? [],
        assignmentsResult.data ?? [],
        resultTypesResult.data ?? [],
        axesResult.data ?? [],
        traitsResult.data ?? []
      )
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: getErrorMessage(error, "툰-비티아이 작가 통계를 불러오지 못했습니다.")
      },
      { status: 500 }
    );
  }
}
