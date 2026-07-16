import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  buildAdminGrowthAnalytics,
  type GrowthAnalyticsArtist,
  type GrowthAnalyticsStat
} from "@/lib/domain/admin-growth-analytics";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function readAllStats() {
  const supabase = getSupabaseAdminClient() as any;
  const rows: GrowthAnalyticsStat[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("artist_stats")
      .select("artist_id, recorded_date, followers, post_count")
      .order("recorded_date", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as GrowthAnalyticsStat[]));
    if ((data ?? []).length < pageSize) break;
  }

  return rows;
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdminClient() as any;
    const [artistsResult, stats] = await Promise.all([
      supabase
        .from("artists")
        .select("id, name, instagram_handle, status")
        .order("name"),
      readAllStats()
    ]);
    if (artistsResult.error) throw artistsResult.error;

    return NextResponse.json({
      analytics: buildAdminGrowthAnalytics(
        (artistsResult.data ?? []) as GrowthAnalyticsArtist[],
        stats
      )
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "성장 통계를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
