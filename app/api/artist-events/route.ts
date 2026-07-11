import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import {
  ARTIST_EVENT_TYPES,
  EMPTY_ARTIST_STATS,
  getArtistStatsThreshold,
  normalizeArtistEventType,
  type ArtistEventType,
  type ArtistStatsPeriod,
  type ArtistStatsSummary
} from "@/lib/artist-events";
import { getSupabaseAdminClient } from "@/lib/supabase";

const ARTIST_EVENT_LOG_PAGE_SIZE = 1000;

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function isArtistEventType(value: string): value is ArtistEventType {
  return ARTIST_EVENT_TYPES.includes(value as ArtistEventType);
}

export async function POST(request: Request) {
  try {
    const { artistId, eventType } = (await request.json()) as {
      artistId?: string;
      eventType?: string;
    };

    if (!artistId || !eventType || !isArtistEventType(eventType)) {
      return NextResponse.json({ message: "Invalid artist event payload." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("artist_event_logs").insert({
      artist_id: artistId,
      event_type: normalizeArtistEventType(eventType)
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: "작가 이벤트 기록에 실패했습니다." },
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
    const period: ArtistStatsPeriod =
      rawPeriod === "day" || rawPeriod === "week" || rawPeriod === "year" || rawPeriod === "all"
        ? rawPeriod
        : "all";

    const supabase = getSupabaseAdminClient();
    const threshold = getArtistStatsThreshold(period);
    const byArtist = new Map<string, ArtistStatsSummary>();

    for (let page = 0; ; page += 1) {
      const from = page * ARTIST_EVENT_LOG_PAGE_SIZE;
      const to = from + ARTIST_EVENT_LOG_PAGE_SIZE - 1;
      let query = supabase
        .from("artist_event_logs")
        .select("artist_id, event_type")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (threshold) {
        query = query.gte("created_at", threshold);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      (data ?? []).forEach((item) => {
        const current = byArtist.get(item.artist_id) ?? {
          artist_id: item.artist_id,
          ...EMPTY_ARTIST_STATS
        };

        const normalizedEventType = normalizeArtistEventType(item.event_type as ArtistEventType);
        current[normalizedEventType] += 1;
        byArtist.set(item.artist_id, current);
      });

      if (!data || data.length < ARTIST_EVENT_LOG_PAGE_SIZE) {
        break;
      }
    }

    return NextResponse.json({
      period,
      stats: Array.from(byArtist.values())
    });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "통계 데이터를 불러오지 못했습니다.") },
      { status: 500 }
    );
  }
}
