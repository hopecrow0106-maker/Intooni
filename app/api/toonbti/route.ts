import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/api-error";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  ToonbtiQuestionGroupInsert,
  ToonbtiQuestionOptionInsert
} from "@/lib/types";

type ToonbtiEntity = "group" | "option";

type ToonbtiGroupPayload = Partial<ToonbtiQuestionGroupInsert> & {
  entity: "group";
  id?: string;
};

type ToonbtiOptionPayload = Partial<ToonbtiQuestionOptionInsert> & {
  entity: "option";
  id?: string;
};

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function normalizeKey(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}

function normalizeText(value?: string) {
  return value?.trim() ?? "";
}

async function getNextSortOrder(entity: ToonbtiEntity, groupId?: string) {
  const supabase = getSupabaseAdminClient();

  if (entity === "group") {
    const { data, error } = await supabase
      .from("toonbti_question_groups")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("toonbti_question_options")
    .select("sort_order")
    .eq("group_id", groupId ?? "")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.sort_order ?? -1) + 1;
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const supabase = getSupabaseAdminClient();
    const [{ data: groups, error: groupsError }, { data: options, error: optionsError }] =
      await Promise.all([
        supabase
          .from("toonbti_question_groups")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("toonbti_question_options")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      ]);

    if (groupsError) {
      throw groupsError;
    }

    if (optionsError) {
      throw optionsError;
    }

    return NextResponse.json({
      groups: groups ?? [],
      options: options ?? []
    });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "툰비티아이 항목을 불러오지 못했습니다.") },
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
    const payload = (await request.json()) as ToonbtiGroupPayload | ToonbtiOptionPayload;

    if (payload.entity === "group") {
      const label = normalizeText(payload.label);
      const key = normalizeKey(payload.key || payload.label);

      if (!label || !key) {
        return NextResponse.json(
          { message: "그룹 이름과 key는 필수입니다." },
          { status: 400 }
        );
      }

      const insertPayload: ToonbtiQuestionGroupInsert = {
        key,
        label,
        description: normalizeText(payload.description),
        selection_mode:
          payload.selection_mode === "multi" ? "multi" : "single",
        max_selections:
          payload.selection_mode === "multi"
            ? Math.max(Number(payload.max_selections ?? 2), 1)
            : 1,
        sort_order:
          payload.sort_order ?? (await getNextSortOrder("group")),
        is_active: payload.is_active ?? true
      };

      const { data, error } = await supabase
        .from("toonbti_question_groups")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json(data, { status: 201 });
    }

    const groupId = normalizeText(payload.group_id);
    const label = normalizeText(payload.label);
    const key = normalizeKey(payload.key || payload.label);

    if (!groupId || !label || !key) {
      return NextResponse.json(
        { message: "선택지는 그룹, 이름, key가 필요합니다." },
        { status: 400 }
      );
    }

    const insertPayload: ToonbtiQuestionOptionInsert = {
      group_id: groupId,
      key,
      label,
      description: normalizeText(payload.description),
      sort_order:
        payload.sort_order ?? (await getNextSortOrder("option", groupId)),
      is_active: payload.is_active ?? true
    };

    const { data, error } = await supabase
      .from("toonbti_question_options")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "툰비티아이 항목 저장에 실패했습니다.") },
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
    const payload = (await request.json()) as ToonbtiGroupPayload | ToonbtiOptionPayload;

    if (!payload.id) {
      return NextResponse.json({ message: "id가 필요합니다." }, { status: 400 });
    }

    if (payload.entity === "group") {
      const label = normalizeText(payload.label);
      const key = normalizeKey(payload.key || payload.label);

      if (!label || !key) {
        return NextResponse.json(
          { message: "그룹 이름과 key는 필수입니다." },
          { status: 400 }
        );
      }

      const updatePayload: Partial<ToonbtiQuestionGroupInsert> = {
        key,
        label,
        description: normalizeText(payload.description),
        selection_mode:
          payload.selection_mode === "multi" ? "multi" : "single",
        max_selections:
          payload.selection_mode === "multi"
            ? Math.max(Number(payload.max_selections ?? 2), 1)
            : 1,
        sort_order: payload.sort_order ?? 0,
        is_active: payload.is_active ?? true
      };

      const { data, error } = await supabase
        .from("toonbti_question_groups")
        .update(updatePayload)
        .eq("id", payload.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json(data);
    }

    const groupId = normalizeText(payload.group_id);
    const label = normalizeText(payload.label);
    const key = normalizeKey(payload.key || payload.label);

    if (!groupId || !label || !key) {
      return NextResponse.json(
        { message: "선택지는 그룹, 이름, key가 필요합니다." },
        { status: 400 }
      );
    }

    const updatePayload: Partial<ToonbtiQuestionOptionInsert> = {
      group_id: groupId,
      key,
      label,
      description: normalizeText(payload.description),
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true
    };

    const { data, error } = await supabase
      .from("toonbti_question_options")
      .update(updatePayload)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "툰비티아이 항목 수정에 실패했습니다.") },
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
    const payload = (await request.json()) as { entity?: ToonbtiEntity; id?: string };

    if (!payload.entity || !payload.id) {
      return NextResponse.json(
        { message: "삭제할 entity와 id가 필요합니다." },
        { status: 400 }
      );
    }

    const table =
      payload.entity === "group"
        ? "toonbti_question_groups"
        : "toonbti_question_options";

    const { error } = await supabase.from(table).delete().eq("id", payload.id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "툰비티아이 항목 삭제에 실패했습니다.") },
      { status: 500 }
    );
  }
}
