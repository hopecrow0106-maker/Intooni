import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { getSupabaseAdminClient, getSupabasePublicServerClient } from "@/lib/supabase";
import type { Artist, ArtistInsert } from "@/lib/types";

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
  try {
    const supabase = getSupabasePublicServerClient();
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .order("is_ad", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(data ?? []);
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
    const payload = (await request.json()) as ArtistInsert;

    if (!payload.last_stats_updated_at) {
      payload.last_stats_updated_at = new Date().toISOString();
    }

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

    const { data, error } = await supabase.from("artists").insert(payload).select().single();

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

    const payloadArtist = payload as ArtistInsert;

    if (!payloadArtist.id) {
      return NextResponse.json({ message: "작가 id가 필요합니다." }, { status: 400 });
    }

    const { data: existingArtist, error: existingArtistError } = await supabase
      .from("artists")
      .select("thumbnail_url, character_url, followers, post_count, last_stats_updated_at")
      .eq("id", payloadArtist.id)
      .single();

    if (existingArtistError) {
      throw existingArtistError;
    }

    if (
      existingArtist &&
      (existingArtist.followers !== payloadArtist.followers ||
        existingArtist.post_count !== payloadArtist.post_count)
    ) {
      payloadArtist.last_stats_updated_at = new Date().toISOString();
    } else if (!payloadArtist.last_stats_updated_at && existingArtist?.last_stats_updated_at) {
      payloadArtist.last_stats_updated_at = existingArtist.last_stats_updated_at;
    }

    const { data, error } = await supabase
      .from("artists")
      .update(payloadArtist)
      .eq("id", payloadArtist.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (existingArtist?.thumbnail_url && existingArtist.thumbnail_url !== payloadArtist.thumbnail_url) {
      await removeStorageFile(existingArtist.thumbnail_url);
    }

    if (existingArtist?.character_url && existingArtist.character_url !== payloadArtist.character_url) {
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

    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("thumbnail_url, character_url")
      .eq("id", id)
      .single();

    if (artistError) {
      throw artistError;
    }

    const { error } = await supabase.from("artists").delete().eq("id", id);
    if (error) {
      throw error;
    }

    await removeStorageFile(artist?.thumbnail_url);
    await removeStorageFile(artist?.character_url);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "작가 삭제에 실패했습니다.") },
      { status: 500 }
    );
  }
}
