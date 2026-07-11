import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { isEmail } from "@/lib/domain/admin-artist-details";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { email?: string | null; dm_available?: boolean | null };
    const email = body.email?.trim() || null;
    if (email && !isEmail(email)) {
      return NextResponse.json({ message: "올바른 이메일 형식이 아닙니다." }, { status: 400 });
    }
    if (body.dm_available !== null && typeof body.dm_available !== "boolean") {
      return NextResponse.json({ message: "DM 가능 여부 값이 올바르지 않습니다." }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdminClient()
      .from("artist_contacts")
      .upsert(
        {
          artist_id: params.id,
          email,
          dm_available: body.dm_available ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "artist_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "연락정보 저장에 실패했습니다.") },
      { status: 500 }
    );
  }
}
