"use client";

import Image from "next/image";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { InstagramEmbed } from "@/components/InstagramEmbed";
import type { Artist, Category } from "@/lib/types";

export type ArtistFormValues = {
  id?: string;
  name: string;
  instagram_handle: string;
  genre: string;
  followers: number;
  post_count: number;
  last_stats_updated_at: string;
  hashtags: string[];
  hidden_tags: string[];
  mood_tags: string[];
  episode_formats: string[];
  style_tags: string[];
  topic_tags: string[];
  memo: string;
  bio: string;
  thumbnail_url: string;
  character_url: string;
  gallery_post_urls: string[];
  is_ad: boolean;
  is_hot: boolean;
  hide_from_new: boolean;
  sort_order: number;
};

type ArtistFormProps = {
  isOpen: boolean;
  initialArtist: Artist | null;
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: ArtistFormValues) => Promise<void>;
  onCategoriesChanged: () => Promise<void>;
};

type UploadingState = {
  thumbnail: boolean;
  character: boolean;
};

type TagFieldKey =
  | "hashtags"
  | "hidden_tags"
  | "mood_tags"
  | "episode_formats"
  | "style_tags"
  | "topic_tags";

const EMPTY_GALLERY_POST_URLS = ["", "", "", ""];

function formatDateTimeLabel(value?: string) {
  if (!value) {
    return "기록 없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function createInitialState(artist: Artist | null, categories: Category[]): ArtistFormValues {
  return {
    id: artist?.id,
    name: artist?.name ?? "",
    instagram_handle: artist?.instagram_handle ?? "",
    genre: artist?.genre ?? categories[0]?.name ?? "",
    followers: artist?.followers ?? 0,
    post_count: artist?.post_count ?? 0,
    last_stats_updated_at: artist?.last_stats_updated_at ?? new Date().toISOString(),
    hashtags: artist?.hashtags ?? [],
    hidden_tags: artist?.hidden_tags ?? [],
    mood_tags: artist?.mood_tags ?? [],
    episode_formats: artist?.episode_formats ?? [],
    style_tags: artist?.style_tags ?? [],
    topic_tags: artist?.topic_tags ?? [],
    memo: artist?.memo ?? "",
    bio: artist?.bio ?? "",
    thumbnail_url: artist?.thumbnail_url ?? "",
    character_url: artist?.character_url ?? "",
    gallery_post_urls: artist?.gallery_post_urls.length
      ? [...artist.gallery_post_urls, ...EMPTY_GALLERY_POST_URLS].slice(0, 4)
      : [...EMPTY_GALLERY_POST_URLS],
    is_ad: artist?.is_ad ?? false,
    is_hot: artist?.is_hot ?? false,
    hide_from_new: artist?.hide_from_new ?? false,
    sort_order: artist?.sort_order ?? 0
  };
}

function isKoreanComposing(event: ReactKeyboardEvent<HTMLInputElement>) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

function TagSection({
  label,
  helper,
  inputValue,
  onInputChange,
  onAdd,
  onKeyDown,
  tags,
  onRemove,
  chipClassName = "rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600"
}: {
  label: string;
  helper?: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  tags: string[];
  onRemove: (value: string) => void;
  chipClassName?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {helper ? <p className="text-xs text-slate-400">{helper}</p> : null}
      </div>
      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="입력 후 Enter"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
        />
        <button
          type="button"
          onClick={onAdd}
          className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
        >
          추가
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onRemove(tag)}
            className={chipClassName}
          >
            {tag} ×
          </button>
        ))}
      </div>
    </div>
  );
}

export function ArtistForm({
  isOpen,
  initialArtist,
  categories,
  saving,
  onClose,
  onSave,
  onCategoriesChanged
}: ArtistFormProps) {
  const [form, setForm] = useState<ArtistFormValues>(createInitialState(initialArtist, categories));
  const [tagInput, setTagInput] = useState("");
  const [hiddenTagInput, setHiddenTagInput] = useState("");
  const [moodInput, setMoodInput] = useState("");
  const [episodeFormatInput, setEpisodeFormatInput] = useState("");
  const [styleInput, setStyleInput] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [uploading, setUploading] = useState<UploadingState>({
    thumbnail: false,
    character: false
  });
  const [categoryInput, setCategoryInput] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  useEffect(() => {
    setForm(createInitialState(initialArtist, categories));
    setTagInput("");
    setHiddenTagInput("");
    setMoodInput("");
    setEpisodeFormatInput("");
    setStyleInput("");
    setTopicInput("");
    setFormMessage("");
    setUploading({ thumbnail: false, character: false });
  }, [categories, initialArtist, isOpen]);

  useEffect(() => {
    if (!form.genre && categories[0]?.name) {
      setForm((current) => ({ ...current, genre: categories[0].name }));
    }
  }, [categories, form.genre]);

  if (!isOpen) {
    return null;
  }

  const formId = "artist-admin-form";
  const isBusy = saving || uploading.thumbnail || uploading.character || categoryBusy;
  const primaryPreviewUrl = form.gallery_post_urls[0]?.trim() ?? "";

  const uploadFile = async (file: File, folder = "artists") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData
    });

    const data = (await response.json()) as { publicUrl?: string; message?: string };
    if (!response.ok || !data.publicUrl) {
      throw new Error(data.message ?? "이미지 업로드에 실패했습니다.");
    }

    return data.publicUrl;
  };

  const updateGalleryPostUrlAt = (index: number, value: string) => {
    setForm((current) => {
      const next = [...current.gallery_post_urls];
      next[index] = value;
      return { ...current, gallery_post_urls: next };
    });
  };

  const handleThumbnailUpload = async (file?: File) => {
    if (!file) {
      return;
    }

    setUploading((current) => ({ ...current, thumbnail: true }));
    try {
      setFormMessage("");
      const publicUrl = await uploadFile(file, "artists");
      setForm((current) => ({ ...current, thumbnail_url: publicUrl }));
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "썸네일 업로드에 실패했습니다.");
    } finally {
      setUploading((current) => ({ ...current, thumbnail: false }));
    }
  };

  const handleCharacterUpload = async (file?: File) => {
    if (!file) {
      return;
    }

    setUploading((current) => ({ ...current, character: true }));
    try {
      setFormMessage("");
      const publicUrl = await uploadFile(file, "characters");
      setForm((current) => ({ ...current, character_url: publicUrl }));
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "누끼 이미지 업로드에 실패했습니다.");
    } finally {
      setUploading((current) => ({ ...current, character: false }));
    }
  };

  const addVisibleTag = () => {
    const normalized = tagInput.trim();
    if (!normalized) {
      return;
    }

    const withHash = normalized.startsWith("#") ? normalized : `#${normalized}`;
    setForm((current) => ({
      ...current,
      hashtags: current.hashtags.includes(withHash)
        ? current.hashtags
        : [...current.hashtags, withHash]
    }));
    setTagInput("");
  };

  const addHiddenTag = () => {
    const normalized = hiddenTagInput.trim();
    if (!normalized) {
      return;
    }

    setForm((current) => ({
      ...current,
      hidden_tags: current.hidden_tags.includes(normalized)
        ? current.hidden_tags
        : [...current.hidden_tags, normalized]
    }));
    setHiddenTagInput("");
  };

  const addArrayValue = (field: TagFieldKey, rawValue: string, clear: () => void) => {
    const normalized = rawValue.trim();
    if (!normalized) {
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: current[field].includes(normalized)
        ? current[field]
        : [...current[field], normalized]
    }));
    clear();
  };

  const removeArrayValue = (field: TagFieldKey, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((item) => item !== value)
    }));
  };

  const saveCategory = async () => {
    const name = categoryInput.trim();
    if (!name) {
      return;
    }

    setCategoryBusy(true);
    try {
      setFormMessage("");
      const method = editingCategoryId ? "PUT" : "POST";
      const payload = editingCategoryId ? { id: editingCategoryId, name } : { name };

      const response = await fetch("/api/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "카테고리 저장에 실패했습니다.");
      }

      await onCategoriesChanged();
      if (!form.genre || (initialArtist && form.genre === initialArtist.genre)) {
        setForm((current) => ({ ...current, genre: name }));
      }
      setCategoryInput("");
      setEditingCategoryId(null);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "카테고리 저장에 실패했습니다.");
    } finally {
      setCategoryBusy(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    const confirmed = window.confirm(`${category.name} 카테고리를 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setCategoryBusy(true);
    try {
      setFormMessage("");
      const response = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id })
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "카테고리 삭제에 실패했습니다.");
      }

      const fallbackGenre = categories.find((item) => item.id !== category.id)?.name ?? "";
      await onCategoriesChanged();

      if (form.genre === category.name) {
        setForm((current) => ({ ...current, genre: fallbackGenre }));
      }
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "카테고리 삭제에 실패했습니다.");
    } finally {
      setCategoryBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/50" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 h-[94vh] overflow-y-auto rounded-t-[32px] bg-[#fffdf9] p-5 shadow-[0_-24px_70px_rgba(16,24,40,0.24)] md:left-auto md:right-6 md:top-6 md:h-auto md:max-h-[calc(100vh-3rem)] md:w-[720px] md:rounded-[32px] xl:w-[1120px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-coral">Admin Form</p>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">
              {initialArtist ? "작가 수정" : "작가 추가"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form={formId}
              disabled={isBusy || !form.genre}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral disabled:cursor-wait disabled:opacity-70"
            >
              {isBusy ? "저장 중.." : "저장하기"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,720px)_minmax(300px,1fr)]">
          <form
            id={formId}
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setFormMessage("");

              await onSave({
                ...form,
                instagram_handle: form.instagram_handle.replace(/^@/, ""),
                hashtags: form.hashtags.map((tag) => tag.trim()).filter(Boolean),
                hidden_tags: form.hidden_tags.map((tag) => tag.trim()).filter(Boolean),
                mood_tags: form.mood_tags.map((tag) => tag.trim()).filter(Boolean),
                episode_formats: form.episode_formats.map((tag) => tag.trim()).filter(Boolean),
                style_tags: form.style_tags.map((tag) => tag.trim()).filter(Boolean),
                topic_tags: form.topic_tags.map((tag) => tag.trim()).filter(Boolean),
                gallery_post_urls: form.gallery_post_urls.map((url) => url.trim()).filter(Boolean)
              });
            }}
          >
          {formMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">작가명</span>
              <input
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">인스타 계정</span>
              <input
                required
                value={form.instagram_handle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instagram_handle: event.target.value.replace(/^@/, "")
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">요즘 뜨는 작가</span>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, is_hot: !current.is_hot }))}
                className={`switch-track ${form.is_hot ? "bg-coral" : "bg-slate-300"}`}
              >
                <span className={`switch-thumb ${form.is_hot ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">AD 상단 노출</span>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, is_ad: !current.is_ad }))}
                className={`switch-track ${form.is_ad ? "bg-coral" : "bg-slate-300"}`}
              >
                <span className={`switch-thumb ${form.is_ad ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">NEW 제외</span>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, hide_from_new: !current.hide_from_new }))}
                className={`switch-track ${form.hide_from_new ? "bg-slate-500" : "bg-slate-300"}`}
              >
                <span
                  className={`switch-thumb ${form.hide_from_new ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">카테고리</span>
              <select
                value={form.genre}
                onChange={(event) => setForm((current) => ({ ...current, genre: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              >
                {categories.length === 0 ? (
                  <option value="">카테고리를 먼저 추가해 주세요</option>
                ) : (
                  categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">카테고리 관리</span>
              {categoryBusy ? <span className="text-xs text-slate-400">처리 중..</span> : null}
            </div>
            <div className="flex gap-2">
              <input
                value={categoryInput}
                onChange={(event) => setCategoryInput(event.target.value)}
                placeholder="새 카테고리 이름"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
              <button
                type="button"
                onClick={() => void saveCategory()}
                className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
              >
                {editingCategoryId ? "수정" : "추가"}
              </button>
              {editingCategoryId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategoryId(null);
                    setCategoryInput("");
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  취소
                </button>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700"
                >
                  <span>{category.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategoryId(category.id);
                      setCategoryInput(category.name);
                    }}
                    className="text-xs font-semibold text-coral"
                  >
                    편집
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteCategory(category)}
                    className="text-xs font-semibold text-red-500"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">팔로워 수</span>
              <input
                min={0}
                type="number"
                value={form.followers}
                onChange={(event) =>
                  setForm((current) => ({ ...current, followers: Number(event.target.value) }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">게시물 수</span>
              <input
                min={0}
                type="number"
                value={form.post_count}
                onChange={(event) =>
                  setForm((current) => ({ ...current, post_count: Number(event.target.value) }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <div className="space-y-1">
              <p className="font-medium text-slate-600">마지막 통계 업데이트</p>
              <p className="text-slate-500">{formatDateTimeLabel(form.last_stats_updated_at)}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  last_stats_updated_at: new Date().toISOString()
                }))
              }
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-ink hover:text-ink"
            >
              오늘로 갱신
            </button>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600">메모</span>
            <textarea
              value={form.memo}
              onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
              placeholder="작가 소개나 운영 메모를 적어주세요"
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600">공개용 한 줄 소개</span>
            <textarea
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              placeholder="예: 흑백 그림일기로 연애와 일상을 그리는 작가"
              rows={3}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
            />
          </label>

          <TagSection
            label="공개 해시태그"
            inputValue={tagInput}
            onInputChange={setTagInput}
            onAdd={addVisibleTag}
            onKeyDown={(event) => {
              if (isKoreanComposing(event)) {
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                addVisibleTag();
              }
            }}
            tags={form.hashtags}
            onRemove={(value) => removeArrayValue("hashtags", value)}
          />

          <TagSection
            label="숨김 검색 태그"
            helper="사용자에게는 보이지 않고 검색에만 들어갑니다. 예: 이지, 흑백, 그림 일기"
            inputValue={hiddenTagInput}
            onInputChange={setHiddenTagInput}
            onAdd={addHiddenTag}
            onKeyDown={(event) => {
              if (isKoreanComposing(event)) {
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                addHiddenTag();
              }
            }}
            tags={form.hidden_tags}
            onRemove={(value) => removeArrayValue("hidden_tags", value)}
            chipClassName="rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-500"
          />

          <TagSection
            label="툰비티아이 분위기"
            helper="예: 개그, 잔잔, 달달, 고자극, 귀여움"
            inputValue={moodInput}
            onInputChange={setMoodInput}
            onAdd={() => addArrayValue("mood_tags", moodInput, () => setMoodInput(""))}
            onKeyDown={(event) => {
              if (isKoreanComposing(event)) {
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                addArrayValue("mood_tags", moodInput, () => setMoodInput(""));
              }
            }}
            tags={form.mood_tags}
            onRemove={(value) => removeArrayValue("mood_tags", value)}
            chipClassName="rounded-full bg-[#fff0f3] px-3 py-1.5 text-sm text-[#c9153d]"
          />

          <TagSection
            label="툰비티아이 에피소드 형식"
            helper="예: 짧다, 중간, 길다"
            inputValue={episodeFormatInput}
            onInputChange={setEpisodeFormatInput}
            onAdd={() =>
              addArrayValue("episode_formats", episodeFormatInput, () => setEpisodeFormatInput(""))
            }
            onKeyDown={(event) => {
              if (isKoreanComposing(event)) {
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                addArrayValue("episode_formats", episodeFormatInput, () =>
                  setEpisodeFormatInput("")
                );
              }
            }}
            tags={form.episode_formats}
            onRemove={(value) => removeArrayValue("episode_formats", value)}
            chipClassName="rounded-full bg-[#eef7ff] px-3 py-1.5 text-sm text-[#2b6cb0]"
          />

          <TagSection
            label="툰비티아이 그림체"
            helper="예: 단순, 귀여움, 감성적, 현실적, 개성적, 흑백, 컬러풀, 밈"
            inputValue={styleInput}
            onInputChange={setStyleInput}
            onAdd={() => addArrayValue("style_tags", styleInput, () => setStyleInput(""))}
            onKeyDown={(event) => {
              if (isKoreanComposing(event)) {
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                addArrayValue("style_tags", styleInput, () => setStyleInput(""));
              }
            }}
            tags={form.style_tags}
            onRemove={(value) => removeArrayValue("style_tags", value)}
            chipClassName="rounded-full bg-[#f4f0ff] px-3 py-1.5 text-sm text-[#5a43d6]"
          />

          <TagSection
            label="툰비티아이 주제"
            helper="예: 연애, 직장, 일상, 썰, 괴담, 대학생, 여행, 운동, 군대, 워홀, 공룡"
            inputValue={topicInput}
            onInputChange={setTopicInput}
            onAdd={() => addArrayValue("topic_tags", topicInput, () => setTopicInput(""))}
            onKeyDown={(event) => {
              if (isKoreanComposing(event)) {
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                addArrayValue("topic_tags", topicInput, () => setTopicInput(""));
              }
            }}
            tags={form.topic_tags}
            onRemove={(value) => removeArrayValue("topic_tags", value)}
            chipClassName="rounded-full bg-[#fff8e1] px-3 py-1.5 text-sm text-[#946200]"
          />

          <div className="space-y-3">
            <span className="text-sm font-medium text-slate-600">대표 썸네일</span>
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="relative aspect-square overflow-hidden rounded-[24px] border border-dashed border-slate-200 bg-slate-50">
                {form.thumbnail_url ? (
                  <Image src={form.thumbnail_url} alt="대표 썸네일" fill className="object-cover" sizes="180px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    이미지 없음
                  </div>
                )}
                {uploading.thumbnail ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-ink">
                    업로드 중..
                  </div>
                ) : null}
              </div>
              <label className="flex cursor-pointer items-center justify-center rounded-[24px] border border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-600">
                썸네일 업로드
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleThumbnailUpload(event.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, thumbnail_url: "" }))}
                disabled={!form.thumbnail_url || uploading.thumbnail || saving}
                className="rounded-[24px] border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                썸네일 삭제
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-600">캐릭터 누끼 이미지</span>
              <p className="text-xs text-slate-400">
                배경 투명 PNG 권장 / 없으면 히어로에 노출되지 않음
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="relative aspect-square overflow-hidden rounded-[24px] border border-dashed border-slate-200 bg-slate-50">
                {form.character_url ? (
                  <Image
                    src={form.character_url}
                    alt="캐릭터 누끼"
                    fill
                    className="object-contain p-3"
                    sizes="180px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    이미지 없음
                  </div>
                )}
                {uploading.character ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-ink">
                    업로드 중..
                  </div>
                ) : null}
              </div>
              <label className="flex cursor-pointer items-center justify-center rounded-[24px] border border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-600">
                누끼 이미지 업로드
                <input
                  type="file"
                  accept="image/png,image/webp,image/*"
                  className="hidden"
                  onChange={(event) => void handleCharacterUpload(event.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, character_url: "" }))}
                disabled={!form.character_url || uploading.character || saving}
                className="rounded-[24px] border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                누끼 이미지 삭제
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium text-slate-600">갤러리 게시물 링크 1~4</span>
            <div className="grid gap-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600">갤러리 게시물 링크 {index + 1}</span>
                    <input
                      value={form.gallery_post_urls[index]}
                      onChange={(event) => updateGalleryPostUrlAt(index, event.target.value)}
                      placeholder="https://www.instagram.com/p/..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink"
                    />
                  </label>
                  {form.gallery_post_urls[index].trim() ? (
                    <InstagramEmbed url={form.gallery_post_urls[index]} compact className="min-h-[160px]" />
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                      링크를 입력하면 실제 인스타 게시물 미리보기가 바로 표시됩니다.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isBusy || !form.genre}
            className="w-full rounded-full bg-ink px-5 py-4 text-sm font-semibold text-white transition hover:bg-coral disabled:cursor-wait disabled:opacity-70"
          >
            {isBusy ? "저장 중.." : "저장하기"}
          </button>
          </form>

          <aside className="hidden xl:block">
            <div className="sticky top-0 space-y-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700">통계 참고용 게시물</p>
                <p className="text-xs leading-5 text-slate-400">
                  갤러리 게시물 링크 1번을 옆에 고정해서 보여줍니다. 팔로워/게시물 수 수정할 때
                  참고하세요.
                </p>
              </div>

              {primaryPreviewUrl ? (
                <InstagramEmbed
                  url={primaryPreviewUrl}
                  compact
                  className="min-h-[420px] rounded-[24px] border border-slate-200 bg-white"
                />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm leading-6 text-slate-400">
                  갤러리 게시물 링크 1번을 입력하면 여기에 인스타 게시물이 표시됩니다.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
