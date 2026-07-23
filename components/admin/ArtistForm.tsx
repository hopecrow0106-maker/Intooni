"use client";

import Image from "next/image";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { InstagramQuickImport } from "@/components/admin/InstagramQuickImport";
import { ArtistInternalManager } from "@/components/admin/ArtistInternalManager";
import { ArtistToonbtiAssignment } from "@/components/admin/ArtistToonbtiAssignment";
import { InstagramEmbed } from "@/components/InstagramEmbed";
import {
  EMPTY_ARTIST_STATS,
  type ArtistStatsPeriod,
  type ArtistStatsSummary
} from "@/lib/artist-events";
import type { Artist, Category } from "@/lib/types";
import { normalizeInstagramHandle } from "@/lib/normalize";

export type ArtistFormValues = {
  id?: string;
  name: string;
  instagram_handle: string;
  main_category_id: string;
  hashtags: string[];
  search_tags: string[];
  mood_tags: string[];
  style_tags: string[];
  topic_tags: string[];
  internal_memo: string;
  bio: string;
  thumbnail_url: string;
  character_url: string;
  gallery_post_urls: string[];
  is_trending: boolean;
  show_on_site: boolean;
  show_growth_on_site: boolean;
  status: "active" | "hidden" | "archived";
  hide_from_new: boolean;
  sort_order: number;
};

type ArtistFormProps = {
  isOpen: boolean;
  initialArtist: Artist | null;
  artists: Artist[];
  categories: Category[];
  stats?: ArtistStatsSummary | null;
  statsPeriod: ArtistStatsPeriod;
  saving: boolean;
  onClose: () => void;
  onSave: (values: ArtistFormValues) => Promise<void>;
  onCategoriesChanged: () => Promise<void>;
};

type UploadingState = {
  thumbnail: boolean;
  character: boolean;
};

type ArtistEditorTab = "profile" | "media" | "internal";

type TagFieldKey =
  | "hashtags"
  | "search_tags";

const EMPTY_GALLERY_POST_URLS = ["", "", "", ""];
const DUPLICATE_STATUS_GROUPS = [
  { status: "active", label: "활성 작가", className: "bg-emerald-50 text-emerald-700" },
  { status: "hidden", label: "숨김 작가", className: "bg-amber-50 text-amber-700" },
  { status: "archived", label: "보관 작가", className: "bg-slate-100 text-slate-600" }
] as const;
const ARTIST_FORM_STATS_METRICS: Array<{
  key: keyof Omit<ArtistStatsSummary, "artist_id">;
  label: string;
  color: string;
  chipClassName: string;
}> = [
  {
    key: "artist_click",
    label: "전체 클릭",
    color: "#6d5efc",
    chipClassName: "bg-[#f4f0ff] text-[#5a43d6]"
  },
  {
    key: "instagram_outbound",
    label: "인스타 이동",
    color: "#ff6f91",
    chipClassName: "bg-[#fff0f3] text-[#c9153d]"
  }
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function getStatsPeriodLabel(period: ArtistStatsPeriod) {
  switch (period) {
    case "day":
      return "오늘";
    case "week":
      return "7일";
    case "year":
      return "1년";
    case "all":
    default:
      return "전체";
  }
}

function getStatsTotal(stats: ArtistStatsSummary) {
  return ARTIST_FORM_STATS_METRICS.reduce((sum, metric) => sum + stats[metric.key], 0);
}

function createInitialState(artist: Artist | null, categories: Category[]): ArtistFormValues {
  return {
    id: artist?.id,
    name: artist?.name ?? "",
    instagram_handle: artist?.instagram_handle ?? "",
    main_category_id:
      artist?.main_category_id ??
      categories.find((category) => category.name === artist?.genre)?.id ??
      categories[0]?.id ??
      "",
    hashtags: artist?.hashtags ?? [],
    search_tags: artist?.search_tags ?? [],
    mood_tags: artist?.mood_tags ?? [],
    style_tags: artist?.style_tags ?? [],
    topic_tags: artist?.topic_tags ?? [],
    internal_memo: artist?.internal_memo ?? "",
    bio: artist?.bio ?? "",
    thumbnail_url: artist?.thumbnail_url ?? "",
    character_url: artist?.character_url ?? "",
    gallery_post_urls: artist?.gallery_post_urls.length
      ? [...artist.gallery_post_urls, ...EMPTY_GALLERY_POST_URLS].slice(0, 4)
      : [...EMPTY_GALLERY_POST_URLS],
    is_trending: artist?.is_trending ?? false,
    show_on_site: artist?.show_on_site ?? true,
    show_growth_on_site: artist?.show_growth_on_site ?? true,
    status: artist?.status ?? "active",
    hide_from_new: artist?.hide_from_new ?? false,
    sort_order: artist?.sort_order ?? 0
  };
}

function CompactToggle({
  label,
  helper,
  active,
  onToggle,
  activeClassName = "bg-coral"
}: {
  label: string;
  helper: string;
  active: boolean;
  onToggle: () => void;
  activeClassName?: string;
}) {
  return (
    <div className="flex min-h-[72px] flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <p className="whitespace-nowrap text-xs font-semibold text-slate-700">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="min-w-0 text-[9px] leading-3 text-slate-400">{helper}</p>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onToggle}
          className={`switch-track shrink-0 ${active ? activeClassName : "bg-slate-300"}`}
        >
          <span className={`switch-thumb ${active ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
    </div>
  );
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

function ArtistStatsBreakdown({
  stats,
  period,
  hasArtist
}: {
  stats?: ArtistStatsSummary | null;
  period: ArtistStatsPeriod;
  hasArtist: boolean;
}) {
  const safeStats: ArtistStatsSummary = {
    artist_id: stats?.artist_id ?? "",
    ...(stats ?? EMPTY_ARTIST_STATS)
  };
  const [open, setOpen] = useState(false);
  const total = getStatsTotal(safeStats);
  const maxValue = Math.max(...ARTIST_FORM_STATS_METRICS.map((metric) => safeStats[metric.key]), 1);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">수정 및 정보 확인</p>
          <p className="mt-1 text-xs text-slate-400">
            {getStatsPeriodLabel(period)} 기준 작가 클릭과 인스타그램 외부 이동입니다.
          </p>
        </div>
        <span className="self-start rounded-full bg-[#f4f0ff] px-3 py-1.5 text-sm font-bold text-[#5a43d6]">
          총 {formatNumber(total)}
        </span>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="self-start rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
        >
          {open ? "접기" : "열기"}
        </button>
      </div>

      {open ? !hasArtist ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          신규 작가는 저장 후 통계가 표시됩니다.
        </div>
      ) : total === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          아직 집계된 반응이 없습니다.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {ARTIST_FORM_STATS_METRICS.map((metric) => (
            <div key={metric.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${metric.chipClassName}`}>
                  {metric.label}
                </span>
                <span className="font-semibold text-slate-600">
                  {formatNumber(safeStats[metric.key])}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((safeStats[metric.key] / maxValue) * 100, safeStats[metric.key] > 0 ? 4 : 0)}%`,
                    backgroundColor: metric.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ArtistForm({
  isOpen,
  initialArtist,
  artists,
  categories,
  stats,
  statsPeriod,
  saving,
  onClose,
  onSave,
  onCategoriesChanged
}: ArtistFormProps) {
  const [form, setForm] = useState<ArtistFormValues>(createInitialState(initialArtist, categories));
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    JSON.stringify(createInitialState(initialArtist, categories))
  );
  const [tagInput, setTagInput] = useState("");
  const [hiddenTagInput, setHiddenTagInput] = useState("");
  const [uploading, setUploading] = useState<UploadingState>({
    thumbnail: false,
    character: false
  });
  const [categoryInput, setCategoryInput] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [editorTab, setEditorTab] = useState<ArtistEditorTab>("profile");

  useEffect(() => {
    const nextForm = createInitialState(initialArtist, categories);
    setForm(nextForm);
    setInitialSnapshot(JSON.stringify(nextForm));
    setTagInput("");
    setHiddenTagInput("");
    setFormMessage("");
    setEditorTab("profile");
    setUploading({ thumbnail: false, character: false });
  }, [categories, initialArtist, isOpen]);

  useEffect(() => {
    if (!form.main_category_id && categories[0]?.id) {
      setForm((current) => ({ ...current, main_category_id: categories[0].id }));
    }
  }, [categories, form.main_category_id]);

  if (!isOpen) {
    return null;
  }

  const formId = "artist-admin-form";
  const isBusy = saving || uploading.thumbnail || uploading.character || categoryBusy;
  const primaryPreviewUrl = form.gallery_post_urls[0]?.trim() ?? "";
  const hasUnsavedChanges = JSON.stringify(form) !== initialSnapshot;
  const duplicateArtists = form.instagram_handle.trim()
    ? artists.filter(
        (artist) =>
          artist.id !== initialArtist?.id &&
          normalizeInstagramHandle(artist.instagram_handle) === normalizeInstagramHandle(form.instagram_handle)
      )
    : [];
  const hasDuplicateInstagramHandle = duplicateArtists.length > 0;

  const requestClose = () => {
    if (isBusy) {
      return;
    }

    if (
      hasUnsavedChanges &&
      !window.confirm("작성 중인 내용이 있습니다. 닫으면 입력한 내용이 사라집니다. 닫을까요?")
    ) {
      return;
    }

    onClose();
  };

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
      search_tags: current.search_tags.includes(normalized)
        ? current.search_tags
        : [...current.search_tags, normalized]
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

      const data = (await response.json()) as { id?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "카테고리 저장에 실패했습니다.");
      }

      await onCategoriesChanged();
      if (data.id) {
        setForm((current) => ({ ...current, main_category_id: data.id ?? current.main_category_id }));
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

      const fallbackCategoryId = categories.find((item) => item.id !== category.id)?.id ?? "";
      await onCategoriesChanged();

      if (form.main_category_id === category.id) {
        setForm((current) => ({ ...current, main_category_id: fallbackCategoryId }));
      }
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "카테고리 삭제에 실패했습니다.");
    } finally {
      setCategoryBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100">
      <div
        className="absolute inset-0 overflow-y-auto bg-slate-100"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                {form.thumbnail_url ? (
                  <Image src={form.thumbnail_url} alt="" fill className="object-cover" sizes="48px" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-bold text-ink">
                    {form.name || (initialArtist ? "작가 수정" : "새 작가")}
                  </h2>
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${form.status === "active" ? "bg-emerald-50 text-emerald-700" : form.status === "hidden" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {form.status === "active" ? "활성" : form.status === "hidden" ? "숨김" : "보관"}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  @{form.instagram_handle || "instagram"} · {initialArtist ? "작가 정보 편집" : "새 작가 등록"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editorTab !== "internal" ? (
                <button
                  type="submit"
                  form={formId}
                  disabled={isBusy || !form.main_category_id || hasDuplicateInstagramHandle}
                  className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isBusy ? "저장 중..." : "저장"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={requestClose}
                className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-400"
              >
                목록으로
              </button>
            </div>
          </div>

          <nav className="mx-auto flex max-w-[1600px] overflow-x-auto px-4 md:px-6">
            {([
              ["profile", "기본 정보", "프로필·공개 설정·태그"],
              ["media", "미디어", "대표 이미지·캐릭터·게시물"],
              ["internal", "내부 정보", "통계·연락처·협업·B2B"]
            ] as const).map(([key, label, description]) => (
              <button
                key={key}
                type="button"
                onClick={() => setEditorTab(key)}
                className={`min-w-max border-b-2 px-4 py-3 text-left transition ${editorTab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                <span className="block text-sm font-bold">{label}</span>
                <span className="mt-0.5 hidden text-[11px] sm:block">{description}</span>
              </button>
            ))}
          </nav>
        </header>

        <div className={`mx-auto max-w-[1600px] px-4 py-5 md:px-6 ${editorTab === "internal" ? "block" : "grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
          <form
            id={formId}
            className={editorTab === "internal" ? "hidden" : "space-y-5"}
            onSubmit={async (event) => {
              event.preventDefault();
              setFormMessage("");

              if (hasDuplicateInstagramHandle) {
                setFormMessage("같은 인스타그램 아이디가 이미 등록되어 있어 저장할 수 없습니다.");
                return;
              }

              await onSave({
                ...form,
                instagram_handle: form.instagram_handle.replace(/^@/, ""),
                hashtags: form.hashtags.map((tag) => tag.trim()).filter(Boolean),
                search_tags: form.search_tags.map((tag) => tag.trim()).filter(Boolean),
                mood_tags: form.mood_tags.map((tag) => tag.trim()).filter(Boolean),
                style_tags: form.style_tags.map((tag) => tag.trim()).filter(Boolean),
                topic_tags: form.topic_tags.map((tag) => tag.trim()).filter(Boolean),
                gallery_post_urls: form.gallery_post_urls.map((url) => url.trim()).filter(Boolean),
                is_trending: form.is_trending
              });
            }}
          >
          {formMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formMessage}
            </div>
          ) : null}

          {editorTab === "profile" ? (
          <div className="space-y-5">
          <InstagramQuickImport
            onApply={(values) => {
              setForm((current) => ({
                ...current,
                name: values.name || current.name,
                instagram_handle: values.instagram_handle || current.instagram_handle,
                bio: values.bio || current.bio,
                thumbnail_url: values.thumbnail_url || current.thumbnail_url,
                gallery_post_urls: values.gallery_post_urls
                  ? [...values.gallery_post_urls, "", "", "", ""].slice(0, 4)
                  : current.gallery_post_urls
              }));
              setFormMessage("");
            }}
          />

          <ArtistStatsBreakdown
            stats={stats}
            period={statsPeriod}
            hasArtist={Boolean(initialArtist)}
          />

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-800">기본 정보 및 공개 설정</h3>
              <p className="mt-1 text-[11px] text-slate-400">
                공개 상태와 홈 노출 옵션을 한곳에서 관리합니다.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">작가명</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-ink"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">인스타 계정</span>
                <input
                  required
                  value={form.instagram_handle}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      instagram_handle: event.target.value.replace(/^@/, "")
                    }))
                  }
                  aria-describedby={hasDuplicateInstagramHandle ? "instagram-handle-duplicate-warning" : undefined}
                  className={`h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-ink ${
                    hasDuplicateInstagramHandle ? "border-amber-400 bg-amber-50" : "border-slate-200"
                  }`}
                />
                {hasDuplicateInstagramHandle ? (
                  <div id="instagram-handle-duplicate-warning" className="space-y-1.5 text-xs text-amber-800">
                    <p className="font-semibold">이미 등록된 계정입니다. 상태를 확인해 주세요.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DUPLICATE_STATUS_GROUPS.map((group) => {
                        const matchingArtists = duplicateArtists.filter(
                          (artist) => (artist.status ?? "active") === group.status
                        );
                        if (matchingArtists.length === 0) return null;

                        return (
                          <span key={group.status} className={`rounded px-2 py-1 font-semibold ${group.className}`}>
                            {group.label}: {matchingArtists.map((artist) => artist.name).join(", ")}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </label>

              <label className="space-y-1.5 md:col-span-2 xl:col-span-1">
                <span className="text-xs font-semibold text-slate-600">카테고리</span>
                <select
                  value={form.main_category_id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, main_category_id: event.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-ink"
                >
                  {categories.length === 0 ? (
                    <option value="">카테고리를 먼저 추가해 주세요</option>
                  ) : (
                    categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-[11px] font-bold uppercase text-slate-400">노출 설정</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <label className="flex min-h-[72px] flex-col justify-center rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <span className="text-xs font-semibold text-slate-700">관리 상태</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => {
                        const status = event.target.value as ArtistFormValues["status"];

                        return {
                          ...current,
                          status,
                          show_on_site: status === "active"
                        };
                      })
                    }
                    className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-ink"
                  >
                    <option value="active">활성</option>
                    <option value="hidden">숨김</option>
                    <option value="archived">보관</option>
                  </select>
                </label>

                <CompactToggle
                  label="사이트 공개"
                  helper="프로필·검색 노출"
                  active={form.status === "active" && form.show_on_site}
                  onToggle={() =>
                    setForm((current) => {
                      const showOnSite = !(current.status === "active" && current.show_on_site);

                      return {
                        ...current,
                        show_on_site: showOnSite,
                        status: showOnSite ? "active" : "hidden"
                      };
                    })
                  }
                />

                <CompactToggle
                  label="성장 공개"
                  helper="증가량·증가율 노출"
                  active={form.show_growth_on_site}
                  onToggle={() =>
                    setForm((current) => ({
                      ...current,
                      show_growth_on_site: !current.show_growth_on_site
                    }))
                  }
                />

                <CompactToggle
                  label="요즘 뜨는 작가"
                  helper="홈 추천 영역 노출"
                  active={form.is_trending}
                  onToggle={() =>
                    setForm((current) => ({ ...current, is_trending: !current.is_trending }))
                  }
                />

                <CompactToggle
                  label="NEW 제외"
                  helper="신규 작가 영역 제외"
                  active={form.hide_from_new}
                  activeClassName="bg-slate-500"
                  onToggle={() =>
                    setForm((current) => ({ ...current, hide_from_new: !current.hide_from_new }))
                  }
                />
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-[10px] leading-4 text-slate-500 md:grid-cols-2">
              <p className="rounded-md bg-slate-50 px-2.5 py-2">
                웹사이트 공개 OFF: 내부 DB에는 유지되지만 공개 사이트, 상세 페이지, 검색,
                sitemap에서 제외됩니다.
              </p>
              <p className="rounded-md bg-slate-50 px-2.5 py-2">
                성장률 공개 OFF: 통계 수집은 계속되며 공개 사이트의 증가량과 증가율만 숨깁니다.
              </p>
            </div>
          </section>

          <ArtistToonbtiAssignment artistId={initialArtist?.id} />

          <div className="rounded-xl border border-slate-200 bg-white p-4">
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

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600">내부 운영 메모</span>
            <textarea
              value={form.internal_memo}
              onChange={(event) =>
                setForm((current) => ({ ...current, internal_memo: event.target.value }))
              }
              placeholder="공개되지 않는 운영 메모"
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600">공개용 소개 (줄바꿈 유지)</span>
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
            label="검색 태그"
            helper="작가 검색에 사용하며 공개 API에 포함될 수 있습니다."
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
            tags={form.search_tags}
            onRemove={(value) => removeArrayValue("search_tags", value)}
            chipClassName="rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-500"
          />

          </div>
          ) : null}

          {editorTab === "media" ? (
          <div className="space-y-5">
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
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600">갤러리 게시물 링크 {index + 1}</span>
                    <input
                      value={form.gallery_post_urls[index]}
                      onChange={(event) => updateGalleryPostUrlAt(index, event.target.value)}
                      placeholder="https://www.instagram.com/p/..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink"
                    />
                  </label>
                  {form.gallery_post_urls[index].trim() ? (
                    <InstagramEmbed
                      url={form.gallery_post_urls[index]}
                      compact
                      className="max-h-[300px] min-h-[180px] rounded-lg"
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                      링크를 입력하면 실제 인스타 게시물 미리보기가 바로 표시됩니다.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          </div>
          ) : null}

          </form>

          {editorTab !== "internal" ? (
            <aside className="hidden xl:block">
              <div className="sticky top-[150px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-bold text-ink">
                    {editorTab === "profile" ? "공개 프로필 미리보기" : "대표 게시물 미리보기"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">실제 공개 화면의 핵심 정보만 축약해 보여줍니다.</p>
                </div>
                {editorTab === "profile" ? (
                  <div className="p-4">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
                      {form.thumbnail_url ? (
                        <Image src={form.thumbnail_url} alt={form.name || "작가 미리보기"} fill className="object-cover" sizes="328px" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">대표 이미지 없음</div>
                      )}
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-ink">{form.name || "작가명"}</h3>
                    <p className="mt-1 text-sm text-slate-500">@{form.instagram_handle || "instagram"}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {form.hashtags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{tag}</span>
                      ))}
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-keep text-sm leading-6 text-slate-600">{form.bio || "공개용 소개가 여기에 표시됩니다."}</p>
                    {form.instagram_handle.trim() ? (
                      <a
                        href={`https://www.instagram.com/${encodeURIComponent(form.instagram_handle.replace(/^@/, "").trim())}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-pink-400 hover:text-pink-600"
                      >
                        Instagram 바로가기
                        <span aria-hidden="true">↗</span>
                      </a>
                    ) : null}
                  </div>
                ) : primaryPreviewUrl ? (
                  <div className="p-4">
                    <InstagramEmbed url={primaryPreviewUrl} compact className="max-h-[420px] min-h-[260px] rounded-md border border-slate-200 bg-white" />
                  </div>
                ) : (
                  <div className="flex min-h-[300px] items-center justify-center px-6 text-center text-sm leading-6 text-slate-400">
                    갤러리 게시물 링크 1번을 입력하면 여기에 표시됩니다.
                  </div>
                )}
              </div>
            </aside>
          ) : null}

          {editorTab === "internal" ? (
            <ArtistInternalManager artistId={initialArtist?.id} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
