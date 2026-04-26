import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/api-error";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient, getSupabasePublicServerClient } from "@/lib/supabase";
import type { Category } from "@/lib/types";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  try {
    const supabase = getSupabasePublicServerClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "카테고리 목록을 불러오지 못했습니다.") },
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
    const { name } = (await request.json()) as { name?: string };

    if (!name?.trim()) {
      return NextResponse.json({ message: "카테고리 이름을 입력해주세요." }, { status: 400 });
    }

    const { data: lastCategory, error: lastCategoryError } = await supabase
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCategoryError) {
      throw lastCategoryError;
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: name.trim(),
        sort_order: ((lastCategory as Pick<Category, "sort_order"> | null)?.sort_order ?? -1) + 1
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "카테고리 저장에 실패했습니다.") },
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
    const { id, name } = (await request.json()) as { id?: string; name?: string };

    if (!id || !name?.trim()) {
      return NextResponse.json(
        { message: "카테고리 id와 이름이 필요합니다." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "카테고리 수정에 실패했습니다.") },
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
      return NextResponse.json({ message: "카테고리 id가 필요합니다." }, { status: 400 });
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "카테고리 삭제에 실패했습니다.") },
      { status: 500 }
    );
  }
}
