import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { getSupabaseAdminClient, getSupabasePublicServerClient } from "@/lib/supabase";
import type { MagazineInsert } from "@/lib/types";

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

export async function GET() {
  try {
    const isAdmin = isAdminAuthenticated();
    const supabase = isAdmin ? getSupabaseAdminClient() : getSupabasePublicServerClient();

    let query = supabase
      .from("magazines")
      .select("*")
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "매거진 목록을 불러오지 못했습니다.") },
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

    const { data, error } = await supabase.from("magazines").insert(payload).select().single();

    if (error) {
      throw error;
    }

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

    if (!payload.id) {
      return NextResponse.json({ message: "매거진 id가 필요합니다." }, { status: 400 });
    }

    const { data: existingMagazine, error: existingMagazineError } = await supabase
      .from("magazines")
      .select("thumbnail_url")
      .eq("id", payload.id)
      .single();

    if (existingMagazineError) {
      throw existingMagazineError;
    }

    const { data, error } = await supabase
      .from("magazines")
      .update(payload)
      .eq("id", payload.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

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
