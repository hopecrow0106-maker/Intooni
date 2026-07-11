import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import {
  sanitizeArtistPayload,
  type AdminArtistPayload
} from "@/lib/domain/admin-artist";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Artist } from "@/lib/types";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; details?: string; hint?: string; message?: string };
  const text = [maybeError.code, maybeError.details, maybeError.hint, maybeError.message]
    .filter(Boolean)
    .join(" ");

  return text.includes(columnName) && (text.includes("column") || maybeError.code === "PGRST204");
}

function isTargetSchemaMissing(error: unknown) {
  return [
    "main_category_id",
    "search_tags",
    "show_on_site",
    "show_growth_on_site",
    "is_trending",
    "status",
    "internal_memo"
  ].some((column) => isMissingColumnError(error, column));
}

async function getCategoryName(categoryId?: string | null) {
  if (!categoryId) return "";
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw error;
  return data?.name ?? "";
}

async function toLegacyArtistPayload(payload: AdminArtistPayload) {
  const legacy: Record<string, unknown> = {};
  const copy = (target: string, source: keyof AdminArtistPayload = target as keyof AdminArtistPayload) => {
    if (payload[source] !== undefined) legacy[target] = payload[source];
  };
  copy("name");
  copy("instagram_handle");
  copy("bio");
  copy("hashtags");
  copy("mood_tags");
  copy("style_tags");
  copy("topic_tags");
  copy("thumbnail_url");
  copy("character_url");
  copy("gallery_post_urls");
  copy("hide_from_new");
  copy("sort_order");
  if (payload.main_category_id !== undefined) legacy.genre = await getCategoryName(payload.main_category_id);
  if (payload.search_tags !== undefined) legacy.hidden_tags = payload.search_tags;
  if (payload.internal_memo !== undefined) legacy.memo = payload.internal_memo;
  if (payload.is_trending !== undefined) legacy.is_hot = payload.is_trending;
  return legacy;
}

function extractStoragePath(publicUrl: string) {
  const marker = "/storage/v1/object/public/artist-images/";
  const index = publicUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

async function removeStorageFile(url?: string | null) {
  if (!url) {
    return;
  }

  const path = extractStoragePath(url);
  if (!path) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  await supabase.storage.from("artist-images").remove([path]);
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("artists")
      .select(`
        id, name, instagram_handle, main_category_id, bio, hashtags, search_tags,
        mood_tags, style_tags, topic_tags, thumbnail_url, character_url,
        gallery_post_urls, show_on_site, show_growth_on_site, is_trending,
        hide_from_new, status, sort_order, internal_memo, created_at, updated_at,
        main_category:categories!artists_main_category_id_fkey(name)
      `)
      .order("sort_order", { ascending: true });

    if (error) {
      const legacy = await supabase
        .from("artists")
        .select("*")
        .order("sort_order", { ascending: true });
      if (legacy.error) throw error;
      const categoryResult = await supabase.from("categories").select("id, name");
      if (categoryResult.error) throw categoryResult.error;
      const categoryIds = new Map(
        (categoryResult.data ?? []).map((category: any) => [category.name, category.id])
      );
      return NextResponse.json(
        (legacy.data ?? []).map((artist: any) => ({
          ...artist,
          main_category_id: categoryIds.get(artist.genre) ?? null,
          search_tags: artist.hidden_tags ?? [],
          internal_memo: artist.memo ?? "",
          is_trending: artist.is_hot ?? false,
          show_on_site: true,
          show_growth_on_site: true,
          status: "active",
          updated_at: artist.updated_at ?? artist.created_at ?? null
        }))
      );
    }

    const artistIds = (data ?? []).map((artist: any) => artist.id);
    const statsResult = artistIds.length
      ? await supabase
          .from("artist_stats")
          .select("artist_id, recorded_date, followers, post_count")
          .in("artist_id", artistIds)
          .order("recorded_date", { ascending: false })
          .limit(Math.max(artistIds.length * 2, 100))
      : { data: [], error: null };
    if (statsResult.error) throw statsResult.error;

    const [contactsResult, collaborationsResult, b2bResult] = artistIds.length
      ? await Promise.all([
          supabase.from("artist_contacts").select("artist_id").in("artist_id", artistIds),
          supabase.from("artist_collaborations").select("artist_id").in("artist_id", artistIds),
          supabase.from("artist_b2b_profiles").select("artist_id").in("artist_id", artistIds)
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null }
        ];
    if (contactsResult.error) throw contactsResult.error;
    if (collaborationsResult.error) throw collaborationsResult.error;
    if (b2bResult.error) throw b2bResult.error;
    const contactArtistIds = new Set(
      (contactsResult.data ?? []).map((item: { artist_id: string }) => item.artist_id)
    );
    const collaborationArtistIds = new Set(
      (collaborationsResult.data ?? []).map((item: { artist_id: string }) => item.artist_id)
    );
    const b2bArtistIds = new Set(
      (b2bResult.data ?? []).map((item: { artist_id: string }) => item.artist_id)
    );

    const latestStats = new Map<string, any>();
    for (const stat of statsResult.data ?? []) {
      if (!latestStats.has(stat.artist_id)) latestStats.set(stat.artist_id, stat);
    }

    return NextResponse.json(
      (data ?? []).map((artist: any) => {
        const latest = latestStats.get(artist.id);
        return {
          ...artist,
          genre: artist.main_category?.name ?? "",
          followers: latest?.followers ?? 0,
          post_count: latest?.post_count ?? 0,
          weekly_follower_growth: null,
          weekly_post_growth: null,
          weekly_follower_growth_rate: null,
          weekly_post_growth_rate: null,
          stats_period_start: null,
          stats_period_end: latest?.recorded_date ?? null,
          last_stats_updated_at: latest?.recorded_date ?? "",
          has_contact: contactArtistIds.has(artist.id),
          has_collaboration: collaborationArtistIds.has(artist.id),
          has_b2b: b2bArtistIds.has(artist.id)
        };
      })
    );
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "작가 목록을 불러오지 못했습니다.") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const supabase = getSupabaseAdminClient();
    const payload = sanitizeArtistPayload(await request.json());

    if (payload.sort_order === undefined) {
      const { data: lastArtist, error: lastArtistError } = await supabase
        .from("artists")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastArtistError) {
        throw lastArtistError;
      }

      const typedLastArtist = lastArtist as Pick<Artist, "sort_order"> | null;
      payload.sort_order = (typedLastArtist?.sort_order ?? -1) + 1;
    }

    let { data, error } = await (supabase as any).from("artists").insert(payload).select().single();

    if (error && isTargetSchemaMissing(error)) {
      const retry = await supabase
        .from("artists")
        .insert((await toLegacyArtistPayload(payload)) as never)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "작가 저장에 실패했습니다.") },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const supabase = getSupabaseAdminClient();
    const payload = await request.json();

    if (payload.mode === "reorder") {
      const updates = payload.artists as { id: string; sort_order: number }[];
      const results = await Promise.all(
        updates.map((artist) =>
          supabase.from("artists").update({ sort_order: artist.sort_order }).eq("id", artist.id)
        )
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw failed.error;
      }

      return NextResponse.json({ success: true });
    }

    const payloadArtist = sanitizeArtistPayload(payload, true);

    if (!payloadArtist.id) {
      return NextResponse.json({ message: "작가 id가 필요합니다." }, { status: 400 });
    }

    const { data: existingArtist, error: existingArtistError } = await supabase
      .from("artists")
      .select("thumbnail_url, character_url")
      .eq("id", payloadArtist.id)
      .single();

    if (existingArtistError) {
      throw existingArtistError;
    }

    const { id, ...artistUpdate } = payloadArtist;

    let { data, error } = await (supabase as any)
      .from("artists")
      .update(artistUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error && isTargetSchemaMissing(error)) {
      const retry = await supabase
        .from("artists")
        .update((await toLegacyArtistPayload(artistUpdate)) as never)
        .eq("id", id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      throw error;
    }

    if (artistUpdate.thumbnail_url !== undefined && existingArtist?.thumbnail_url && existingArtist.thumbnail_url !== artistUpdate.thumbnail_url) {
      await removeStorageFile(existingArtist.thumbnail_url);
    }

    if (artistUpdate.character_url !== undefined && existingArtist?.character_url && existingArtist.character_url !== artistUpdate.character_url) {
      await removeStorageFile(existingArtist.character_url);
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "작가 수정에 실패했습니다.") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { id } = (await request.json()) as { id?: string };

    if (!id) {
      return NextResponse.json({ message: "작가 id가 필요합니다." }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("artists")
      .update({
        status: "archived",
        show_on_site: false,
        show_growth_on_site: false,
        hide_from_new: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          message:
            "작가를 보관 처리하려면 DB additive migration이 먼저 필요합니다. 실제 삭제는 수행하지 않았습니다."
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, archived: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "작가 삭제에 실패했습니다.") },
      { status: 500 }
    );
  }
}
