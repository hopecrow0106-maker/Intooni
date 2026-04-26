import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { getSupabaseAdminClient } from "@/lib/supabase";

type SearchQueryPeriod = "day" | "week" | "year" | "all";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function getThreshold(period: SearchQueryPeriod) {
  const now = Date.now();

  switch (period) {
    case "day":
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case "week":
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "year":
      return new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
    case "all":
    default:
      return null;
  }
}

export async function POST(request: Request) {
  try {
    const { query } = (await request.json()) as { query?: string };
    const normalizedQuery = query?.trim().toLowerCase();

    if (!normalizedQuery) {
      return NextResponse.json({ message: "검색어가 비어 있습니다." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("search_query_logs").insert({
      query: normalizedQuery
    });

    if (error) {
      if ((error as { code?: string }).code === "PGRST205") {
        return NextResponse.json({ success: true, skipped: true });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "검색어 기록에 실패했습니다.") },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawPeriod = searchParams.get("period") ?? "all";
    const period: SearchQueryPeriod =
      rawPeriod === "day" || rawPeriod === "week" || rawPeriod === "year" || rawPeriod === "all"
        ? rawPeriod
        : "all";

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("search_query_logs")
      .select("query, created_at")
      .order("created_at", { ascending: false });

    const threshold = getThreshold(period);
    if (threshold) {
      query = query.gte("created_at", threshold);
    }

    const { data, error } = await query;

    if (error) {
      if ((error as { code?: string }).code === "PGRST205") {
        return NextResponse.json({
          period,
          queries: [],
          setupRequired: true
        });
      }
      throw error;
    }

    const byQuery = new Map<string, { query: string; count: number; latest_at: string }>();

    (data ?? []).forEach((item) => {
      const current = byQuery.get(item.query) ?? {
        query: item.query,
        count: 0,
        latest_at: item.created_at
      };
      current.count += 1;
      if (item.created_at > current.latest_at) {
        current.latest_at = item.created_at;
      }
      byQuery.set(item.query, current);
    });

    return NextResponse.json({
      period,
      queries: Array.from(byQuery.values()).sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return b.latest_at.localeCompare(a.latest_at);
      })
    });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "검색어 통계를 불러오지 못했습니다.") },
      { status: 500 }
    );
  }
}
