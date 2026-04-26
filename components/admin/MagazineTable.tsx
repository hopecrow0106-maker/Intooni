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
          className="panel-surface flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
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
              <p className="mt-1 text-xs font-medium text-slate-400">
                👁️ 조회수 {formatNumber(magazine.view_count)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(magazine)}
              className="rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => onDelete(magazine)}
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
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
