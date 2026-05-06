"use client";

import { useMemo, useState } from "react";

import type { Artist } from "@/lib/types";

type ToonbtiFieldKey = "mood_tags" | "episode_formats" | "style_tags" | "topic_tags";

type ToonbtiTagManagerProps = {
  artists: Artist[];
  saving: boolean;
  onBulkReplace: (field: ToonbtiFieldKey, from: string, to: string) => Promise<void>;
  onBulkDelete: (field: ToonbtiFieldKey, value: string) => Promise<void>;
  onOpenArtist: (artist: Artist) => void;
};

type TagSummary = {
  value: string;
  count: number;
  artists: Artist[];
};

const FIELD_CONFIG: Array<{ key: ToonbtiFieldKey; label: string; helper: string }> = [
  {
    key: "mood_tags",
    label: "분위기",
    helper: "예: 개그, 잔잔, 달달, 고자극, 귀여움"
  },
  {
    key: "episode_formats",
    label: "에피소드 호흡",
    helper: "예: 짧다, 중간, 길다"
  },
  {
    key: "style_tags",
    label: "그림체",
    helper: "예: 단순, 흑백, 컬러풀, 밈"
  },
  {
    key: "topic_tags",
    label: "주제",
    helper: "예: 연애, 직장, 일상, 공룡"
  }
];

function buildTagSummary(artists: Artist[], field: ToonbtiFieldKey): TagSummary[] {
  const grouped = new Map<string, Artist[]>();

  artists.forEach((artist) => {
    const uniqueValues = [...new Set(artist[field].map((value) => value.trim()).filter(Boolean))];

    uniqueValues.forEach((value) => {
      const current = grouped.get(value) ?? [];
      current.push(artist);
      grouped.set(value, current);
    });
  });

  return [...grouped.entries()]
    .map(([value, matchedArtists]) => ({
      value,
      count: matchedArtists.length,
      artists: matchedArtists.sort((a, b) => a.name.localeCompare(b.name, "ko"))
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "ko"));
}

export function ToonbtiTagManager({
  artists,
  saving,
  onBulkReplace,
  onBulkDelete,
  onOpenArtist
}: ToonbtiTagManagerProps) {
  const [editingField, setEditingField] = useState<ToonbtiFieldKey | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [nextValue, setNextValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const summaries = useMemo(
    () =>
      FIELD_CONFIG.map((field) => ({
        ...field,
        tags: buildTagSummary(artists, field.key)
      })),
    [artists]
  );

  const toggleExpanded = (key: string) => {
    setExpandedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  return (
    <section className="panel-surface p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-coral">ToonBTI Tags</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
            툰비티아이 태그 관리
          </h3>
        </div>
        <p className="text-sm text-slate-500">
          작가 폼에 입력한 툰비티아이 태그를 한눈에 보고, 이름을 한 번에 정리하거나 삭제할 수 있어요.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {summaries.map((field) => (
          <div key={field.key} className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{field.label}</p>
                <p className="mt-1 text-xs text-slate-400">{field.helper}</p>
                <p className="mt-1 text-xs text-slate-400">{field.tags.length}개 항목</p>
              </div>
            </div>

            {field.tags.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                아직 등록된 값이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {field.tags.map((tag) => {
                  const rowKey = `${field.key}-${tag.value}`;
                  const isEditing = editingField === field.key && editingValue === tag.value;
                  const isExpanded = expandedKeys.includes(rowKey);

                  return (
                    <div
                      key={rowKey}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(rowKey)}
                            className="min-w-0 text-left"
                          >
                            <p className="truncate text-sm font-semibold text-ink">{tag.value}</p>
                            <p className="text-xs text-slate-400">
                              {tag.count}명의 작가에 연결됨 · {isExpanded ? "접기" : "펼쳐보기"}
                            </p>
                          </button>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingField(field.key);
                                setEditingValue(tag.value);
                                setNextValue(tag.value);
                              }}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                              disabled={saving}
                            >
                              이름 수정
                            </button>
                            <button
                              type="button"
                              onClick={() => void onBulkDelete(field.key, tag.value)}
                              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                              disabled={saving}
                            >
                              전체 삭제
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="flex flex-col gap-2 md:flex-row">
                            <input
                              value={nextValue}
                              onChange={(event) => setNextValue(event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ink"
                              placeholder="새 이름 입력"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await onBulkReplace(field.key, tag.value, nextValue);
                                setEditingField(null);
                                setEditingValue("");
                                setNextValue("");
                              }}
                              className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral disabled:opacity-70"
                              disabled={saving || !nextValue.trim()}
                            >
                              한 번에 변경
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingField(null);
                                setEditingValue("");
                                setNextValue("");
                              }}
                              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                              disabled={saving}
                            >
                              취소
                            </button>
                          </div>
                        ) : null}

                        {isExpanded ? (
                          <div className="rounded-2xl bg-white px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              {tag.artists.map((artist) => (
                                <button
                                  key={`${rowKey}-${artist.id}`}
                                  type="button"
                                  onClick={() => onOpenArtist(artist)}
                                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                                >
                                  {artist.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
