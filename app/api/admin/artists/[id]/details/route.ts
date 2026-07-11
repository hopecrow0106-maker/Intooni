import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import type { AdminArtistDetails } from "@/lib/domain/admin-artist-details";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isMissingInternalSchema(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  return (
    message.includes("schema cache") &&
    [
      "artist_stats",
      "artist_contacts",
      "artist_collaborations",
      "artist_b2b_profiles",
      "artist_recommended_brand_categories",
      "brand_categories"
    ].some((table) => message.includes(table))
  );
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdminClient() as any;
    const [artist, stats, contact, collaborations, b2b, recommendations, brandCategories] =
      await Promise.all([
        supabase.from("artists").select("id").eq("id", params.id).maybeSingle(),
        supabase
          .from("artist_stats")
          .select("id, artist_id, recorded_date, followers, post_count, created_at, updated_at")
          .eq("artist_id", params.id)
          .order("recorded_date", { ascending: false }),
        supabase
          .from("artist_contacts")
          .select("artist_id, email, dm_available")
          .eq("artist_id", params.id)
          .maybeSingle(),
        supabase
          .from("artist_collaborations")
          .select(
            "id, artist_id, brand_name, brand_category_id, collaboration_year, collaboration_month, post_url, content_summary, ad_disclosure_status, likes, comments, views, created_at, updated_at, brand_category:brand_categories(name)"
          )
          .eq("artist_id", params.id)
          .order("collaboration_year", { ascending: false })
          .order("collaboration_month", { ascending: false }),
        supabase
          .from("artist_b2b_profiles")
          .select("artist_id, strengths, cautions, brand_safety_grade")
          .eq("artist_id", params.id)
          .maybeSingle(),
        supabase
          .from("artist_recommended_brand_categories")
          .select("brand_category_id")
          .eq("artist_id", params.id),
        supabase
          .from("brand_categories")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true })
      ]);

    if (artist.error) throw artist.error;
    if (!artist.data) return NextResponse.json({ message: "작가를 찾을 수 없습니다." }, { status: 404 });
    for (const result of [stats, contact, collaborations, b2b, recommendations, brandCategories]) {
      if (result.error) throw result.error;
    }

    const payload: AdminArtistDetails = {
      stats: stats.data ?? [],
      contact: contact.data ?? null,
      collaborations: (collaborations.data ?? []).map((item: any) => ({
        ...item,
        brand_category_name: item.brand_category?.name ?? null,
        brand_category: undefined
      })),
      b2b: b2b.data
        ? {
            ...b2b.data,
            brand_category_ids: (recommendations.data ?? []).map(
              (item: { brand_category_id: string }) => item.brand_category_id
            )
          }
        : null,
      brand_categories: brandCategories.data ?? []
    };

    return NextResponse.json(
      { ...payload, storageAvailable: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (isMissingInternalSchema(error)) {
      return NextResponse.json(
        {
          stats: [],
          contact: null,
          collaborations: [],
          b2b: null,
          brand_categories: [],
          storageAvailable: false,
          message: "내부 정보 테이블이 아직 준비되지 않아 조회·저장이 비활성화되어 있습니다."
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { message: getErrorMessage(error, "작가 내부 정보를 불러오지 못했습니다.") },
      { status: 500 }
    );
  }
}
