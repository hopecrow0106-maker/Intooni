import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { listPublicMagazines } from "@/lib/server/public-magazines";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { MagazineInsert } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function extractStoragePath(publicUrl: string) {
  const marker = "/storage/v1/object/public/artist-images/";
  const index = publicUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

function isMissingMagazineArtistsTable(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  return (
    message.includes("magazine_artists") &&
    (message.includes("does not exist") ||
      message.includes("could not find a relationship") ||
      message.includes("schema cache"))
  );
}

async function syncMagazineArtists(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  magazineId: string,
  artistIds: string[]
) {
  const uniqueArtistIds = Array.from(new Set((artistIds ?? []).filter(Boolean)));

  const { error: deleteError } = await (supabase as any)
    .from("magazine_artists")
    .delete()
    .eq("magazine_id", magazineId);

  if (deleteError) {
    if (isMissingMagazineArtistsTable(deleteError)) {
      const legacyUpdate = await (supabase as any)
        .from("magazines")
        .update({ related_artist_ids: uniqueArtistIds })
        .eq("id", magazineId);
      if (legacyUpdate.error) throw legacyUpdate.error;
      return;
    }

    throw deleteError;
  }

  if (uniqueArtistIds.length === 0) {
    return;
  }

  const rows = uniqueArtistIds.map((artistId, index) => ({
    magazine_id: magazineId,
    artist_id: artistId,
    sort_order: index
  }));
  const { error: insertError } = await (supabase as any).from("magazine_artists").insert(rows);

  if (insertError) {
    throw insertError;
  }
}

export async function GET() {
  const isAdmin = isAdminAuthenticated();
  try {
    let data;

    if (isAdmin) {
      const supabase = getSupabaseAdminClient();
      const result = await supabase
        .from("magazines")
        .select(
          "id, title, tag, content, thumbnail_url, instagram_urls, view_count, is_public, published_at, created_at, magazine_artists(artist_id, sort_order)"
        )
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (result.error && isMissingMagazineArtistsTable(result.error)) {
        const legacyResult = await (supabase as any)
          .from("magazines")
          .select(
            "id, title, tag, content, thumbnail_url, instagram_urls, view_count, is_public, published_at, created_at, related_artist_ids"
          )
          .order("published_at", { ascending: false })
          .order("created_at", { ascending: false });

        if (legacyResult.error) throw legacyResult.error;
        data = legacyResult.data ?? [];
      } else {
        if (result.error) throw result.error;

        data = (result.data ?? []).map((magazine: any) => ({
          ...magazine,
          related_artist_ids: [...(magazine.magazine_artists ?? [])]
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((relation) => relation.artist_id),
          magazine_artists: undefined
        }));
      }
    } else {
      data = await listPublicMagazines();
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: isAdmin
          ? getErrorMessage(error, "매거진 목록을 불러오지 못했습니다.")
          : "매거진 목록을 불러오지 못했습니다."
      },
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
    const payload = (await request.json()) as MagazineInsert;
    payload.instagram_urls = (payload.instagram_urls ?? []).slice(0, 4);
    const { related_artist_ids: relatedArtistIds = [], ...magazinePayload } = payload;

    const { data, error } = await supabase.from("magazines").insert(magazinePayload).select().single();

    if (error) {
      throw error;
    }

    await syncMagazineArtists(supabase, data.id, relatedArtistIds);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "매거진 저장에 실패했습니다.") },
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
    const payload = (await request.json()) as MagazineInsert;
    payload.instagram_urls = (payload.instagram_urls ?? []).slice(0, 4);
    const { related_artist_ids: relatedArtistIds = [], id, ...magazinePayload } = payload;

    if (!id) {
      return NextResponse.json({ message: "매거진 id가 필요합니다." }, { status: 400 });
    }

    const { data: existingMagazine, error: existingMagazineError } = await supabase
      .from("magazines")
      .select("thumbnail_url")
      .eq("id", id)
      .single();

    if (existingMagazineError) {
      throw existingMagazineError;
    }

    const { data, error } = await supabase
      .from("magazines")
      .update(magazinePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await syncMagazineArtists(supabase, data.id, relatedArtistIds);

    if (existingMagazine?.thumbnail_url && existingMagazine.thumbnail_url !== payload.thumbnail_url) {
      const oldPath = extractStoragePath(existingMagazine.thumbnail_url);
      if (oldPath) {
        await supabase.storage.from("artist-images").remove([oldPath]);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "매거진 수정에 실패했습니다.") },
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
      return NextResponse.json({ message: "매거진 id가 필요합니다." }, { status: 400 });
    }

    const { data: magazine, error: magazineError } = await supabase
      .from("magazines")
      .select("thumbnail_url")
      .eq("id", id)
      .single();

    if (magazineError) {
      throw magazineError;
    }

    const { error } = await supabase.from("magazines").delete().eq("id", id);

    if (error) {
      throw error;
    }

    if (magazine?.thumbnail_url) {
      const path = extractStoragePath(magazine.thumbnail_url);
      if (path) {
        await supabase.storage.from("artist-images").remove([path]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "매거진 삭제에 실패했습니다.") },
      { status: 500 }
    );
  }
}
