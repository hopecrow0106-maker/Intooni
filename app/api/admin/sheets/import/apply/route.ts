import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import {
  applyAdminSheetImport,
  isAdminSheetImportTarget,
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
    const result = await applyAdminSheetImport(target);
    return NextResponse.json(
      result.applied
        ? result
        : { ...result, message: "Sheet preview contains validation errors or conflicts." },
      { status: result.applied ? 200 : 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Google Sheets import apply에 실패했습니다.") },
      { status: 500 }
    );
  }
}
