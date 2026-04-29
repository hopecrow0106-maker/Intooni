"use client";

import { useEffect, useMemo, useState } from "react";

import type { Artist, ToonbtiQuestionGroup, ToonbtiQuestionOption } from "@/lib/types";

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

const FIELD_CONFIG: Array<{ key: ToonbtiFieldKey; label: string }> = [
  { key: "mood_tags", label: "분위기" },
  { key: "episode_formats", label: "에피소드 형식" },
  { key: "style_tags", label: "그림체" },
  { key: "topic_tags", label: "주제" }
];

function buildTagSummary(artists: Artist[], field: ToonbtiFieldKey): TagSummary[] {
  const grouped = new Map<string, Artist[]>();

  artists.forEach((artist) => {
    const uniqueValues = [...new Set(artist[field].map((value) => value.trim()).filter(Boolean))];

    uniqueValues.forEach((value) => {
      const normalized = value.trim();
      const current = grouped.get(normalized) ?? [];
      current.push(artist);
      grouped.set(normalized, current);
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
  const [questionGroups, setQuestionGroups] = useState<ToonbtiQuestionGroup[]>([]);
  const [questionOptions, setQuestionOptions] = useState<ToonbtiQuestionOption[]>([]);
  const [questionMessage, setQuestionMessage] = useState("");
  const [questionBusy, setQuestionBusy] = useState(false);
  const [newOptionByGroup, setNewOptionByGroup] = useState<Record<string, string>>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionLabel, setEditingOptionLabel] = useState("");

  const summaries = useMemo(
    () =>
      FIELD_CONFIG.map((field) => ({
        ...field,
        tags: buildTagSummary(artists, field.key)
      })),
    [artists]
  );

  const fetchQuestions = async () => {
    const response = await fetch("/api/toonbti", { cache: "no-store" });
    const data = (await response.json()) as {
      groups?: ToonbtiQuestionGroup[];
      options?: ToonbtiQuestionOption[];
      message?: string;
    };

    if (!response.ok) {
      throw new Error(data.message ?? "툰비티아이 질문지를 불러오지 못했습니다.");
    }

    setQuestionGroups(data.groups ?? []);
    setQuestionOptions(data.options ?? []);
  };

  useEffect(() => {
    void fetchQuestions().catch((error) => {
      setQuestionMessage(error instanceof Error ? error.message : "질문지를 불러오지 못했습니다.");
    });
  }, []);

  const updateGroup = async (group: ToonbtiQuestionGroup, updates: Partial<ToonbtiQuestionGroup>) => {
    setQuestionBusy(true);
    try {
      setQuestionMessage("");
      const response = await fetch("/api/toonbti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "group",
          ...group,
          ...updates
        })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "질문 수정에 실패했습니다.");
      }
      await fetchQuestions();
    } catch (error) {
      setQuestionMessage(error instanceof Error ? error.message : "질문 수정에 실패했습니다.");
    } finally {
      setQuestionBusy(false);
    }
  };

  const addOption = async (group: ToonbtiQuestionGroup) => {
    const label = newOptionByGroup[group.id]?.trim();
    if (!label) {
      return;
    }

    setQuestionBusy(true);
    try {
      setQuestionMessage("");
      const response = await fetch("/api/toonbti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "option",
          group_id: group.id,
          label,
          key: label,
          description: ""
        })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "선택지 추가에 실패했습니다.");
      }
      setNewOptionByGroup((current) => ({ ...current, [group.id]: "" }));
      await fetchQuestions();
    } catch (error) {
      setQuestionMessage(error instanceof Error ? error.message : "선택지 추가에 실패했습니다.");
    } finally {
      setQuestionBusy(false);
    }
  };

  const updateOption = async (option: ToonbtiQuestionOption, updates: Partial<ToonbtiQuestionOption>) => {
    setQuestionBusy(true);
    try {
      setQuestionMessage("");
      const response = await fetch("/api/toonbti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "option",
          ...option,
          ...updates
        })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "선택지 수정에 실패했습니다.");
      }
      setEditingOptionId(null);
      setEditingOptionLabel("");
      await fetchQuestions();
    } catch (error) {
      setQuestionMessage(error instanceof Error ? error.message : "선택지 수정에 실패했습니다.");
    } finally {
      setQuestionBusy(false);
    }
  };

  const deleteOption = async (option: ToonbtiQuestionOption) => {
    if (!window.confirm(`${option.label} 선택지를 삭제할까요?`)) {
      return;
    }

    setQuestionBusy(true);
    try {
      setQuestionMessage("");
      const response = await fetch("/api/toonbti", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "option", id: option.id })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "선택지 삭제에 실패했습니다.");
      }
      await fetchQuestions();
    } catch (error) {
      setQuestionMessage(error instanceof Error ? error.message : "선택지 삭제에 실패했습니다.");
    } finally {
      setQuestionBusy(false);
    }
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  return (
    <section className="space-y-5">
      <div className="panel-surface p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-coral">ToonBTI Questions</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
              질문지 선택지 관리
            </h3>
          </div>
          <p className="text-sm text-slate-500">
            여기서 바꾼 선택지는 실제 툰비티아이 테스트 화면에 반영됩니다.
          </p>
        </div>

        {questionMessage ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {questionMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {questionGroups
            .filter((group) => ["mood_tags", "episode_formats", "style_tags", "topic_tags"].includes(group.key))
            .map((group) => {
              const options = questionOptions
                .filter((option) => option.group_id === group.id)
                .sort((a, b) => a.sort_order - b.sort_order);

              return (
                <div key={group.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-coral">{group.key}</p>
                      <input
                        value={group.label}
                        onChange={(event) =>
                          setQuestionGroups((current) =>
                            current.map((item) =>
                              item.id === group.id ? { ...item, label: event.target.value } : item
                            )
                          )
                        }
                        onBlur={(event) => void updateGroup(group, { label: event.target.value })}
                        disabled={questionBusy}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-ink"
                      />
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
                      최대
                      <input
                        type="number"
                        min={1}
                        value={group.max_selections}
                        onChange={(event) =>
                          setQuestionGroups((current) =>
                            current.map((item) =>
                              item.id === group.id
                                ? { ...item, max_selections: Number(event.target.value) }
                                : item
                            )
                          )
                        }
                        onBlur={(event) =>
                          void updateGroup(group, {
                            max_selections: Number(event.target.value),
                            selection_mode: Number(event.target.value) > 1 ? "multi" : "single"
                          })
                        }
                        className="w-14 rounded-xl border border-slate-200 px-2 py-1 text-center"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={newOptionByGroup[group.id] ?? ""}
                      onChange={(event) =>
                        setNewOptionByGroup((current) => ({
                          ...current,
                          [group.id]: event.target.value
                        }))
                      }
                      placeholder="새 선택지 추가"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ink"
                    />
                    <button
                      type="button"
                      onClick={() => void addOption(group)}
                      disabled={questionBusy}
                      className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      추가
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {options.map((option) =>
                      editingOptionId === option.id ? (
                        <span key={option.id} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                          <input
                            value={editingOptionLabel}
                            onChange={(event) => setEditingOptionLabel(event.target.value)}
                            className="w-28 bg-transparent text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void updateOption(option, { label: editingOptionLabel, key: editingOptionLabel })}
                            className="text-xs font-bold text-coral"
                          >
                            저장
                          </button>
                        </span>
                      ) : (
                        <span key={option.id} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">
                          {option.label}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOptionId(option.id);
                              setEditingOptionLabel(option.label);
                            }}
                            className="text-xs font-bold text-coral"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteOption(option)}
                            className="text-xs font-bold text-red-500"
                          >
                            삭제
                          </button>
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="panel-surface p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-coral">ToonBTI Tags</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
            툰비티아이 관리
          </h3>
        </div>
        <p className="text-sm text-slate-500">
          태그별 연결 작가를 보고, 이름을 한 번에 정리하거나 삭제할 수 있어요.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {summaries.map((field) => (
          <div key={field.key} className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{field.label}</p>
                <p className="text-xs text-slate-400">{field.tags.length}개 항목</p>
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
      </div>
    </section>
  );
}
