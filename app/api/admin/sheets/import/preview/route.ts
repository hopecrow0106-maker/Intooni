import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import {
  isAdminSheetImportTarget,
  previewAdminSheetImport,
  type AdminSheetImportTarget
} from "@/lib/server/admin-sheets";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

async function getImportTarget(request: Request): Promise<AdminSheetImportTarget | null> {
  try {
    const body = (await request.json()) as { sheet?: string; sheetName?: string };
    const target = body.sheet ?? body.sheetName ?? "artists";
    return isAdminSheetImportTarget(target) ? target : null;
  } catch {
    return "artists";
  }
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const target = await getImportTarget(request);
    if (!target) {
      return NextResponse.json({ message: "Unsupported sheet import target." }, { status: 400 });
    }
    const preview = await previewAdminSheetImport(target);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Google Sheets import preview에 실패했습니다.") },
      { status: 500 }
    );
  }
}
