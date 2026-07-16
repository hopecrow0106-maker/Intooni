"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function ArtistBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      뒤로가기
    </button>
  );
}
