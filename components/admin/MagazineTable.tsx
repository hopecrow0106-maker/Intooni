"use client";

import Image from "next/image";

import { MAGAZINE_RECT_PLACEHOLDER } from "@/lib/placeholders";
import type { Magazine } from "@/lib/types";

type MagazineTableProps = {
  magazines: Magazine[];
  onEdit: (magazine: Magazine) => void;
  onDelete: (magazine: Magazine) => void;
  isSaving: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function MagazineTable({
  magazines,
  onEdit,
  onDelete,
  isSaving
}: MagazineTableProps) {
  return (
    <div className="space-y-3">
      {magazines.map((magazine) => (
        <div
          key={magazine.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              <Image
                src={magazine.thumbnail_url || MAGAZINE_RECT_PLACEHOLDER}
                alt={magazine.title}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div>
              <p className="font-semibold text-ink">{magazine.title}</p>
              <p className="text-sm text-slate-500">
                {magazine.tag || "태그 없음"} · {formatDate(magazine.published_at)}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-500">
                  {magazine.is_public ? "전체공개" : "비공개"}
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-500">
                  조회수 {formatNumber(magazine.view_count)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => onEdit(magazine)}
              className="rounded-lg border border-ink px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => onDelete(magazine)}
              className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
            >
              삭제
            </button>
            {isSaving ? (
              <span className="text-xs font-medium text-slate-400">저장 중...</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
