import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/api-error";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED_FOLDERS = new Set(["artists", "characters", "magazines"]);

type FileLike = Blob & {
  name?: string;
};

function isFileLike(value: unknown): value is FileLike {
  return (
    !!value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

function getExtension(file: FileLike) {
  const fileName = typeof file.name === "string" ? file.name : "";
  const fileNameExtension = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";

  if (fileNameExtension) {
    return fileNameExtension.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  const mime = file.type.toLowerCase();

  if (mime === "image/jpeg") {
    return "jpg";
  }

  if (mime === "image/png") {
    return "png";
  }

  if (mime === "image/webp") {
    return "webp";
  }

  if (mime === "image/gif") {
    return "gif";
  }

  return "bin";
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedFolder = String(formData.get("folder") ?? "artists").trim().toLowerCase();
    const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : "artists";

    if (!isFileLike(file)) {
      return NextResponse.json({ message: "업로드할 이미지 파일이 필요합니다." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ message: "빈 파일은 업로드할 수 없습니다." }, { status: 400 });
    }

    const extension = getExtension(file);
    const filePath = `${folder}/${crypto.randomUUID()}.${extension}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage.from("artist-images").upload(filePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "31536000",
      upsert: false
    });

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl }
    } = supabase.storage.from("artist-images").getPublicUrl(filePath);

    return NextResponse.json({ publicUrl, path: filePath });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "이미지 업로드에 실패했습니다.") },
      { status: 500 }
    );
  }
}

