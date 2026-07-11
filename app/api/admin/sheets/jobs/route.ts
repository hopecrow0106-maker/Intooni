import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getErrorMessage } from "@/lib/api-error";
import { listSheetSyncJobs } from "@/lib/server/admin-sheets";

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const jobs = await listSheetSyncJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Google Sheets job 목록을 불러오지 못했습니다.") },
      { status: 500 }
    );
  }
}
