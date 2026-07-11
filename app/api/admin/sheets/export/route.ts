import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { exportAdminSheets } from "@/lib/server/admin-sheets";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function POST() {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const summary = await exportAdminSheets();
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Google Sheets export에 실패했습니다.") },
      { status: 500 }
    );
  }
}
