"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ToonbtiQuestionGroup, ToonbtiQuestionOption } from "@/lib/types";

type ToonbtiManagerProps = {
  isActive: boolean;
};

type GroupFormState = {
  id?: string;
  key: string;
  label: string;
  description: string;
  selection_mode: "single" | "multi";
  max_selections: number;
  sort_order: number;
  is_active: boolean;
};

type OptionFormState = {
  id?: string;
  group_id: string;
  key: string;
  label: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

const EMPTY_GROUP_FORM: GroupFormState = {
  key: "",
  label: "",
  description: "",
  selection_mode: "single",
  max_selections: 1,
  sort_order: 0,
  is_active: true
};

const EMPTY_OPTION_FORM: OptionFormState = {
  group_id: "",
  key: "",
  label: "",
  description: "",
  sort_order: 0,
  is_active: true
};

function buildGroupForm(group?: ToonbtiQuestionGroup | null): GroupFormState {
  if (!group) {
    return { ...EMPTY_GROUP_FORM };
  }

  return {
    id: group.id,
    key: group.key,
    label: group.label,
    description: group.description,
    selection_mode: group.selection_mode,
    max_selections: group.max_selections,
    sort_order: group.sort_order,
    is_active: group.is_active
  };
}

function buildOptionForm(
  option?: ToonbtiQuestionOption | null,
  groupId?: string
): OptionFormState {
  if (!option) {
    return {
      ...EMPTY_OPTION_FORM,
      group_id: groupId ?? ""
    };
  }

  return {
    id: option.id,
    group_id: option.group_id,
    key: option.key,
    label: option.label,
    description: option.description,
    sort_order: option.sort_order,
    is_active: option.is_active
  };
}

export function ToonbtiManager({ isActive }: ToonbtiManagerProps) {
  const [groups, setGroups] = useState<ToonbtiQuestionGroup[]>([]);
  const [options, setOptions] = useState<ToonbtiQuestionOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupForm, setGroupForm] = useState<GroupFormState>({ ...EMPTY_GROUP_FORM });
  const [optionForm, setOptionForm] = useState<OptionFormState>({ ...EMPTY_OPTION_FORM });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const selectedGroupOptions = useMemo(
    () => options.filter((option) => option.group_id === selectedGroupId),
    [options, selectedGroupId]
  );

  const loadToonbti = useCallback(async () => {
    setLoading(true);
    try {
      setMessage("");
      const response = await fetch("/api/toonbti", { cache: "no-store" });
      const data = (await response.json()) as {
        groups?: ToonbtiQuestionGroup[];
        options?: ToonbtiQuestionOption[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "툰비티아이 항목을 불러오지 못했습니다.");
      }

      const nextGroups = Array.isArray(data.groups) ? data.groups : [];
      const nextOptions = Array.isArray(data.options) ? data.options : [];

      setGroups(nextGroups);
      setOptions(nextOptions);
      setLoaded(true);

      const fallbackGroupId =
        selectedGroupId && nextGroups.some((group) => group.id === selectedGroupId)
          ? selectedGroupId
          : nextGroups[0]?.id ?? "";

      setSelectedGroupId(fallbackGroupId);
      setGroupForm(buildGroupForm(nextGroups.find((group) => group.id === fallbackGroupId) ?? null));
      setOptionForm(buildOptionForm(null, fallbackGroupId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "툰비티아이 항목을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (!isActive || loaded) {
      return;
    }

    void loadToonbti();
  }, [isActive, loaded, loadToonbti]);

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }

    if (!groupForm.id) {
      return;
    }

    if (groupForm.id !== selectedGroup.id) {
      setGroupForm(buildGroupForm(selectedGroup));
      setOptionForm(buildOptionForm(null, selectedGroup.id));
    }
  }, [groupForm.id, selectedGroup]);

  const saveGroup = async () => {
    setSaving(true);
    try {
      setMessage("");
      const method = groupForm.id ? "PUT" : "POST";
      const response = await fetch("/api/toonbti", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "group",
          ...groupForm
        })
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "질문 그룹 저장에 실패했습니다.");
      }

      await loadToonbti();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "질문 그룹 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (group: ToonbtiQuestionGroup) => {
    if (!window.confirm(`${group.label} 그룹을 삭제할까요?`)) {
      return;
    }

    setSaving(true);
    try {
      setMessage("");
      const response = await fetch("/api/toonbti", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "group",
          id: group.id
        })
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "질문 그룹 삭제에 실패했습니다.");
      }

      await loadToonbti();
      setGroupForm({ ...EMPTY_GROUP_FORM });
      setOptionForm({ ...EMPTY_OPTION_FORM });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "질문 그룹 삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const saveOption = async () => {
    if (!selectedGroupId) {
      setMessage("먼저 질문 그룹을 선택해 주세요.");
      return;
    }

    setSaving(true);
    try {
      setMessage("");
      const method = optionForm.id ? "PUT" : "POST";
      const response = await fetch("/api/toonbti", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "option",
          ...optionForm,
          group_id: selectedGroupId
        })
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "선택지 저장에 실패했습니다.");
      }

      await loadToonbti();
      setOptionForm(buildOptionForm(null, selectedGroupId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "선택지 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (option: ToonbtiQuestionOption) => {
    if (!window.confirm(`${option.label} 선택지를 삭제할까요?`)) {
      return;
    }

    setSaving(true);
    try {
      setMessage("");
      const response = await fetch("/api/toonbti", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "option",
          id: option.id
        })
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "선택지 삭제에 실패했습니다.");
      }

      await loadToonbti();
      setOptionForm(buildOptionForm(null, selectedGroupId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "선택지 삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 space-y-6">
      <div className="panel-surface px-6 py-5">
        <p className="text-sm font-medium text-coral">ToonBTI Config</p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-ink">
          툰비티아이 선택지 관리
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          검사 페이지는 아직 만들지 않고, 질문 그룹과 선택지만 먼저 관리자에서 직접 관리합니다.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <div className="panel-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-coral">Question Groups</p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                질문 그룹
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setGroupForm({ ...EMPTY_GROUP_FORM })}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
            >
              새 그룹
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-600">표시 이름</span>
              <input
                value={groupForm.label}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, label: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-600">key</span>
              <input
                value={groupForm.key}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, key: event.target.value }))
                }
                placeholder="mood, episode_format, style, topic"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-600">설명</span>
              <textarea
                rows={3}
                value={groupForm.description}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, description: event.target.value }))
                }
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">선택 방식</span>
                <select
                  value={groupForm.selection_mode}
                  onChange={(event) =>
                    setGroupForm((current) => ({
                      ...current,
                      selection_mode: event.target.value as "single" | "multi",
                      max_selections:
                        event.target.value === "single"
                          ? 1
                          : Math.max(current.max_selections, 2)
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
                >
                  <option value="single">1개 선택</option>
                  <option value="multi">복수 선택</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">최대 선택 수</span>
                <input
                  type="number"
                  min={1}
                  value={groupForm.max_selections}
                  onChange={(event) =>
                    setGroupForm((current) => ({
                      ...current,
                      max_selections: Math.max(Number(event.target.value || 1), 1)
                    }))
                  }
                  disabled={groupForm.selection_mode === "single"}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink disabled:bg-slate-50"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">정렬 순서</span>
                <input
                  type="number"
                  value={groupForm.sort_order}
                  onChange={(event) =>
                    setGroupForm((current) => ({
                      ...current,
                      sort_order: Number(event.target.value || 0)
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
                />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={groupForm.is_active}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, is_active: event.target.checked }))
                }
              />
              활성 상태
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveGroup()}
                disabled={saving}
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral disabled:opacity-70"
              >
                {saving ? "저장 중.." : groupForm.id ? "그룹 수정" : "그룹 추가"}
              </button>
              {groupForm.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => setGroupForm({ ...EMPTY_GROUP_FORM })}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                  >
                    새로 입력
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = groups.find((group) => group.id === groupForm.id);
                      if (target) {
                        void deleteGroup(target);
                      }
                    }}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                  >
                    그룹 삭제
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {loading ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                불러오는 중..
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                아직 만든 질문 그룹이 없습니다.
              </div>
            ) : (
              groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setGroupForm(buildGroupForm(group));
                    setOptionForm(buildOptionForm(null, group.id));
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selectedGroupId === group.id
                      ? "border-ink bg-slate-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{group.label}</p>
                      <p className="text-xs text-slate-500">
                        {group.key} · {group.selection_mode === "multi" ? `최대 ${group.max_selections}개` : "1개 선택"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        group.is_active
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {group.is_active ? "활성" : "비활성"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-coral">Question Options</p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                선택지
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setOptionForm(buildOptionForm(null, selectedGroupId))}
              disabled={!selectedGroupId}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              새 선택지
            </button>
          </div>

          {selectedGroup ? (
            <p className="mt-2 text-sm text-slate-500">
              현재 그룹: <span className="font-semibold text-ink">{selectedGroup.label}</span>
            </p>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              먼저 왼쪽에서 질문 그룹을 선택해 주세요.
            </div>
          )}

          {selectedGroup ? (
            <>
              <div className="mt-5 space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">표시 이름</span>
                  <input
                    value={optionForm.label}
                    onChange={(event) =>
                      setOptionForm((current) => ({ ...current, label: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">key</span>
                  <input
                    value={optionForm.key}
                    onChange={(event) =>
                      setOptionForm((current) => ({ ...current, key: event.target.value }))
                    }
                    placeholder="gag, calm, sweet, intense"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">설명</span>
                  <textarea
                    rows={3}
                    value={optionForm.description}
                    onChange={(event) =>
                      setOptionForm((current) => ({ ...current, description: event.target.value }))
                    }
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-600">정렬 순서</span>
                    <input
                      type="number"
                      value={optionForm.sort_order}
                      onChange={(event) =>
                        setOptionForm((current) => ({
                          ...current,
                          sort_order: Number(event.target.value || 0)
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={optionForm.is_active}
                      onChange={(event) =>
                        setOptionForm((current) => ({
                          ...current,
                          is_active: event.target.checked
                        }))
                      }
                    />
                    활성 상태
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveOption()}
                    disabled={saving}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral disabled:opacity-70"
                  >
                    {saving ? "저장 중.." : optionForm.id ? "선택지 수정" : "선택지 추가"}
                  </button>
                  {optionForm.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setOptionForm(buildOptionForm(null, selectedGroupId))}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                      >
                        새로 입력
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = options.find((option) => option.id === optionForm.id);
                          if (target) {
                            void deleteOption(target);
                          }
                        }}
                        className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                      >
                        선택지 삭제
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {selectedGroupOptions.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                    이 그룹에는 아직 선택지가 없습니다.
                  </div>
                ) : (
                  selectedGroupOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setOptionForm(buildOptionForm(option))}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        optionForm.id === option.id
                          ? "border-ink bg-slate-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{option.label}</p>
                          <p className="text-xs text-slate-500">{option.key}</p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            option.is_active
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {option.is_active ? "활성" : "비활성"}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
