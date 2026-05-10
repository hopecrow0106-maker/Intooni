"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { InstagramEmbed } from "@/components/InstagramEmbed";
import type { Artist, Magazine } from "@/lib/types";

export type MagazineFormValues = {
  id?: string;
  title: string;
  tag: string;
  content: string;
  thumbnail_url: string;
  related_artist_ids: string[];
  instagram_urls: string[];
  published_at: string;
  is_public: boolean;
};

type MagazineFormProps = {
  isOpen: boolean;
  initialMagazine: Magazine | null;
  artists: Artist[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: MagazineFormValues) => Promise<void>;
};

type UploadingState = {
  thumbnail: boolean;
  inlineImage: boolean;
};

type TextBlockSize = "small" | "body" | "large" | "title";
type TextBlockAlign = "left" | "center" | "right";
type EditorMode = "visual" | "raw";

type ContentPreviewBlock =
  | { type: "paragraph"; value: string }
  | {
      type: "text";
      value: string;
      size: TextBlockSize;
      align: TextBlockAlign;
      bold: boolean;
    }
  | { type: "image"; url: string; size: "wide" | "medium" }
  | { type: "instagram"; url: string }
  | { type: "divider" };

const EMPTY_INSTAGRAM_URLS = ["", "", "", ""];

function formatDateInput(value?: string) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function createInitialState(magazine: Magazine | null): MagazineFormValues {
  return {
    id: magazine?.id,
    title: magazine?.title ?? "",
    tag: magazine?.tag ?? "",
    content: magazine?.content ?? "",
    thumbnail_url: magazine?.thumbnail_url ?? "",
    related_artist_ids: magazine?.related_artist_ids ?? [],
    instagram_urls: magazine?.instagram_urls.length
      ? [...magazine.instagram_urls, ...EMPTY_INSTAGRAM_URLS].slice(0, 4)
      : [...EMPTY_INSTAGRAM_URLS],
    published_at: formatDateInput(magazine?.published_at),
    is_public: magazine?.is_public ?? true
  };
}

function buildImageToken(url: string, size: "wide" | "medium") {
  return `\n\n{{image:${url}|${size}}}\n\n`;
}

function buildTextToken(
  value: string,
  size: TextBlockSize,
  align: TextBlockAlign,
  bold = false
) {
  return `\n\n{{text:${value}|${size}|${align}|${bold ? "bold" : "normal"}}}\n\n`;
}

function buildDividerToken() {
  return "\n\n{{divider}}\n\n";
}

function buildInstagramToken(url: string) {
  return `\n\n{{instagram:${url}}}\n\n`;
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

function parseContentPreview(content: string): ContentPreviewBlock[] {
  const blocks: ContentPreviewBlock[] = [];
  const tokenRegex =
    /\{\{divider\}\}|\{\{instagram:(.+?)\}\}|\{\{(image|text):(.+?)\|(wide|medium|small|body|large|title)(?:\|(left|center|right))?(?:\|(bold|normal))?\}\}/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(content)) !== null) {
    const before = stripHtmlTags(content.slice(lastIndex, match.index));
    if (before) {
      blocks.push({ type: "paragraph", value: before });
    }

    if (match[0] === "{{divider}}") {
      blocks.push({ type: "divider" });
    } else if (match[1]) {
      blocks.push({ type: "instagram", url: match[1] });
    } else if (match[2] === "image") {
      blocks.push({
        type: "image",
        url: match[3],
        size: match[4] as "wide" | "medium"
      });
    } else {
      blocks.push({
        type: "text",
        value: stripHtmlTags(match[3]),
        size: match[4] as TextBlockSize,
        align: (match[5] as TextBlockAlign | undefined) ?? "left",
        bold: match[6] === "bold"
      });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  const tail = stripHtmlTags(content.slice(lastIndex));
  if (tail) {
    blocks.push({ type: "paragraph", value: tail });
  }

  return blocks;
}

function getPreviewTextClass(size: TextBlockSize, align: TextBlockAlign, bold: boolean) {
  const sizeClass = {
    small: "text-[13px] leading-7 text-slate-500",
    body: "text-[15px] leading-8 text-slate-700",
    large: "text-xl leading-8 text-ink",
    title: "text-2xl font-extrabold leading-tight text-ink"
  }[size];
  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return `${sizeClass} ${bold ? "font-bold" : ""} ${alignClass}`;
}

export function MagazineForm({
  isOpen,
  initialMagazine,
  artists,
  saving,
  onClose,
  onSave
}: MagazineFormProps) {
  const [form, setForm] = useState<MagazineFormValues>(createInitialState(initialMagazine));
  const [uploading, setUploading] = useState<UploadingState>({
    thumbnail: false,
    inlineImage: false
  });
  const [artistSearch, setArtistSearch] = useState("");
  const [inlineInstagramUrl, setInlineInstagramUrl] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [draftText, setDraftText] = useState("");
  const [draftSize, setDraftSize] = useState<TextBlockSize>("body");
  const [draftAlign, setDraftAlign] = useState<TextBlockAlign>("left");
  const [draftBold, setDraftBold] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setForm(createInitialState(initialMagazine));
    setUploading({ thumbnail: false, inlineImage: false });
    setArtistSearch("");
    setInlineInstagramUrl("");
    setFormMessage("");
    setEditorMode("visual");
    setDraftText("");
    setDraftSize("body");
    setDraftAlign("left");
    setDraftBold(false);
  }, [initialMagazine, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const isBusy = saving || uploading.thumbnail || uploading.inlineImage;
  const contentPreviewBlocks = useMemo(() => parseContentPreview(form.content), [form.content]);

  const selectedArtistSet = useMemo(
    () => new Set(form.related_artist_ids),
    [form.related_artist_ids]
  );

  const filteredArtists = useMemo(() => {
    const query = artistSearch.trim().toLowerCase();

    if (!query) {
      return artists;
    }

    return artists.filter((artist) => {
      return (
        artist.name.toLowerCase().includes(query) ||
        artist.instagram_handle.toLowerCase().includes(query) ||
        artist.genre.toLowerCase().includes(query)
      );
    });
  }, [artistSearch, artists]);

  if (!isOpen) {
    return null;
  }

  const insertContentToken = (token: string) => {
    const textarea = contentTextareaRef.current;

    if (!textarea) {
      setForm((current) => ({
        ...current,
        content: `${current.content}${token}`
      }));
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;

    setForm((current) => ({
      ...current,
      content: `${current.content.slice(0, start)}${token}${current.content.slice(end)}`
    }));

    requestAnimationFrame(() => {
      const nextCursor = start + token.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "magazines");

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData
    });

    const data = (await response.json()) as { publicUrl?: string; message?: string };

    if (!response.ok || !data.publicUrl) {
      throw new Error(data.message ?? "매거진 이미지 업로드에 실패했습니다.");
    }

    return data.publicUrl;
  };

  const appendInlineImage = async (file: File | undefined, size: "wide" | "medium") => {
    if (!file) {
      return;
    }

    setUploading((current) => ({ ...current, inlineImage: true }));

    try {
      const publicUrl = await uploadFile(file);
      insertContentToken(buildImageToken(publicUrl, size));
      setFormMessage("");
    } catch (error) {
      setFormMessage(
        error instanceof Error ? error.message : "본문 이미지 업로드에 실패했습니다."
      );
    } finally {
      setUploading((current) => ({ ...current, inlineImage: false }));
    }
  };

  const appendInlineInstagram = () => {
    const url = inlineInstagramUrl.trim();

    if (!url) {
      setFormMessage("본문에 넣을 인스타 링크를 입력해 주세요.");
      return;
    }

    if (!/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) {
      setFormMessage("인스타그램 링크만 넣을 수 있어요.");
      return;
    }

    insertContentToken(buildInstagramToken(url));
    setInlineInstagramUrl("");
    setFormMessage("");
  };

  const appendDraftText = () => {
    const value = stripHtmlTags(draftText);

    if (!value) {
      setFormMessage("본문에 넣을 문장을 입력해 주세요.");
      return;
    }

    insertContentToken(buildTextToken(value, draftSize, draftAlign, draftBold));
    setDraftText("");
    setFormMessage("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/50" onClick={onClose}>
      <div
        className="absolute inset-x-3 bottom-3 top-3 mx-auto max-w-[1180px] overflow-y-auto rounded-[32px] bg-[#fffdf9] p-5 shadow-[0_24px_90px_rgba(16,24,40,0.28)] md:inset-x-6 md:bottom-6 md:top-6 md:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-20 -mx-5 -mt-5 mb-6 flex items-center justify-between border-b border-slate-100 bg-[#fffdf9]/95 px-5 py-4 backdrop-blur md:-mx-7 md:-mt-7 md:px-7">
          <div>
            <p className="text-sm font-medium text-coral">Magazine Form</p>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">
              {initialMagazine ? "매거진 글 수정" : "매거진 글 작성"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600"
          >
            닫기
          </button>
        </div>

        <form
          className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"
          onSubmit={async (event) => {
            event.preventDefault();
            setFormMessage("");

            if (!form.content.trim()) {
              setFormMessage("본문을 한 개 이상 추가해 주세요.");
              return;
            }

            await onSave({
              ...form,
              instagram_urls: form.instagram_urls.map((url) => url.trim()).filter(Boolean).slice(0, 4),
              published_at: new Date(`${form.published_at}T00:00:00`).toISOString()
            });
          }}
        >
          {formMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 lg:col-span-2">
              {formMessage}
            </div>
          ) : null}

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">제목</span>
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">태그</span>
              <input
                value={form.tag}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tag: event.target.value }))
                }
                placeholder='예: "4월의 테마"'
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>

            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-600">공개 설정</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, is_public: true }))}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    form.is_public
                      ? "bg-ink text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  전체공개
                </button>
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, is_public: false }))}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    !form.is_public
                      ? "bg-ink text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  비공개
                </button>
              </div>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">게시일</span>
              <input
                type="date"
                value={form.published_at}
                onChange={(event) =>
                  setForm((current) => ({ ...current, published_at: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
              />
            </label>

            <div className="space-y-3">
            <span className="text-sm font-medium text-slate-600">커버 이미지</span>
            <div className="grid gap-4">
              <div className="relative aspect-[2/1] overflow-hidden rounded-[24px] border border-dashed border-slate-200 bg-slate-50">
                {form.thumbnail_url ? (
                  <Image
                    src={form.thumbnail_url}
                    alt="매거진 커버"
                    fill
                    className="object-contain"
                    sizes="240px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    이미지 없음
                  </div>
                )}
                {uploading.thumbnail ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-ink">
                    업로드 중...
                  </div>
                ) : null}
              </div>

              <label className="flex cursor-pointer items-center justify-center rounded-[24px] border border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-600">
                커버 업로드
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    setUploading((current) => ({ ...current, thumbnail: true }));
                    try {
                      const publicUrl = await uploadFile(file);
                      setForm((current) => ({ ...current, thumbnail_url: publicUrl }));
                    } catch (error) {
                      setFormMessage(
                        error instanceof Error ? error.message : "매거진 커버 업로드에 실패했습니다."
                      );
                    } finally {
                      setUploading((current) => ({ ...current, thumbnail: false }));
                    }
                  }}
                />
              </label>
            </div>
          </div>

            <button
              type="submit"
              disabled={isBusy}
              className="w-full rounded-full bg-ink px-5 py-4 text-sm font-semibold text-white transition hover:bg-coral disabled:cursor-wait disabled:opacity-70"
            >
              {isBusy ? "저장 중..." : "저장하기"}
            </button>
          </aside>

          <section className="space-y-5">

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">블로그 편집기</p>
                <p className="mt-1 text-xs text-slate-400">
                  본문은 카드 미리보기로 확인하고, 원문 토큰은 필요할 때만 열어 편집합니다.
                </p>
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setEditorMode("visual")}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    editorMode === "visual" ? "bg-ink text-white" : "text-slate-500"
                  }`}
                >
                  편집기
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("raw")}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    editorMode === "raw" ? "bg-ink text-white" : "text-slate-500"
                  }`}
                >
                  원문
                </button>
              </div>
            </div>

            {editorMode === "visual" ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-3">
                  <textarea
                    rows={4}
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                    placeholder="문장을 입력한 뒤 아래 스타일을 고르고 추가하세요."
                    className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={draftSize}
                      onChange={(event) => setDraftSize(event.target.value as TextBlockSize)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none"
                    >
                      <option value="body">본문</option>
                      <option value="title">제목</option>
                      <option value="large">큰 문장</option>
                      <option value="small">작은 설명</option>
                    </select>
                    <select
                      value={draftAlign}
                      onChange={(event) => setDraftAlign(event.target.value as TextBlockAlign)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none"
                    >
                      <option value="left">왼쪽</option>
                      <option value="center">가운데</option>
                      <option value="right">오른쪽</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setDraftBold((current) => !current)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        draftBold
                          ? "border-ink bg-ink text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      굵게
                    </button>
                    <button
                      type="button"
                      onClick={appendDraftText}
                      className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white"
                    >
                      문장 추가
                    </button>
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-100 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">본문 미리보기</p>
                    <span className="text-xs text-slate-400">{contentPreviewBlocks.length}개 블록</span>
                  </div>
                  {contentPreviewBlocks.length > 0 ? (
                    <div className="space-y-4">
                      {contentPreviewBlocks.map((block, index) => {
                        if (block.type === "paragraph") {
                          return (
                            <p
                              key={`preview-paragraph-${index}`}
                              className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700"
                            >
                              {block.value}
                            </p>
                          );
                        }

                        if (block.type === "text") {
                          return (
                            <div
                              key={`preview-text-${index}`}
                              className={getPreviewTextClass(block.size, block.align, block.bold)}
                            >
                              <p className="whitespace-pre-wrap">{block.value}</p>
                            </div>
                          );
                        }

                        if (block.type === "image") {
                          return (
                            <div
                              key={`preview-image-${index}`}
                              className={block.size === "wide" ? "mx-auto max-w-3xl" : "mx-auto max-w-xl"}
                            >
                              <div className="relative overflow-hidden rounded-[18px] border border-slate-100 bg-slate-50">
                                <Image
                                  src={block.url}
                                  alt="본문 이미지 미리보기"
                                  width={1200}
                                  height={800}
                                  className="h-auto max-h-[520px] w-full object-contain"
                                />
                              </div>
                            </div>
                          );
                        }

                        if (block.type === "instagram") {
                          return (
                            <div
                              key={`preview-instagram-${index}`}
                              className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
                            >
                              인스타 임베드: {block.url}
                            </div>
                          );
                        }

                        return (
                          <div key={`preview-divider-${index}`} className="py-3">
                            <div className="h-px bg-slate-200" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
                      아직 본문 블록이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-slate-600">원문 토큰 편집</span>
                <textarea
                  ref={contentTextareaRef}
                  rows={14}
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, content: event.target.value }))
                  }
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-mono text-xs outline-none transition focus:border-ink"
                />
              </label>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">본문 블록 삽입</p>
                <p className="mt-1 text-xs text-slate-400">
                  이미지나 텍스트 블록을 본문 커서 위치에 바로 넣을 수 있습니다.
                </p>
              </div>
              {uploading.inlineImage ? (
                <span className="text-xs font-medium text-slate-400">업로드 중...</span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                큰 이미지 추가
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void appendInlineImage(event.target.files?.[0], "wide")}
                />
              </label>
              <label className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                중간 이미지 추가
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void appendInlineImage(event.target.files?.[0], "medium")}
                />
              </label>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-700">인스타 임베드 삽입</p>
              <p className="mt-1 text-xs text-slate-400">
                본문 중간에 보여줄 인스타 게시물 URL을 넣고 버튼을 누르면 커서 위치에 삽입됩니다.
              </p>
              <div className="mt-3 flex flex-col gap-2 md:flex-row">
                <input
                  value={inlineInstagramUrl}
                  onChange={(event) => setInlineInstagramUrl(event.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                  className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-ink"
                />
                <button
                  type="button"
                  onClick={appendInlineInstagram}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  본문에 인스타 넣기
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-700">텍스트 블록 삽입</p>
              <p className="mt-1 text-xs text-slate-400">
                제목, 작은 글씨, 굵은 글씨, 좌/중/우 정렬 문장을 본문 사이에 바로 넣을 수 있습니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    insertContentToken(buildTextToken("제목을 입력하세요", "title", "left", true))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  제목
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertContentToken(buildTextToken("큰 문장을 입력하세요", "large", "left", true))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  큰 글씨
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertContentToken(buildTextToken("작은 설명을 입력하세요", "small", "left"))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  작은 글씨
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertContentToken(buildTextToken("굵게 강조할 문장", "body", "left", true))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  굵게
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertContentToken(buildTextToken("문장을 입력하세요", "body", "left"))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  앞에 위치
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertContentToken(buildTextToken("문장을 입력하세요", "body", "center"))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  중간에 위치
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertContentToken(buildTextToken("문장을 입력하세요", "body", "right"))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  뒤에 위치
                </button>
                <button
                  type="button"
                  onClick={() => insertContentToken(buildDividerToken())}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  구분선
                </button>
              </div>
            </div>

            <div className="hidden">
              <p>{"{{image:URL|wide}}"} / {"{{image:URL|medium}}"} 형식으로 이미지가 저장됩니다.</p>
              <p>
                {"{{text:문장|title|left|bold}}"} 또는 {"{{text:문장|body|center|normal}}"} 형식으로 텍스트가 저장됩니다.
              </p>
              <p>{"{{instagram:URL}}"} 형식으로 본문 중간 인스타 임베드가 저장됩니다.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-600">관련 작가 선택</span>
              <input
                value={artistSearch}
                onChange={(event) => setArtistSearch(event.target.value)}
                placeholder="작가명, 인스타 계정, 카테고리로 검색"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink"
              />
            </div>

            <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 md:grid-cols-2">
              {filteredArtists.length > 0 ? (
                filteredArtists.map((artist) => (
                  <label
                    key={artist.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedArtistSet.has(artist.id)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          related_artist_ids: event.target.checked
                            ? [...current.related_artist_ids, artist.id]
                            : current.related_artist_ids.filter((item) => item !== artist.id)
                        }))
                      }
                    />
                    <span className="text-sm text-slate-700">
                      {artist.name} · {artist.genre}
                    </span>
                  </label>
                ))
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 md:col-span-2">
                  검색되는 작가가 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium text-slate-600">인스타 링크 (최대 4개)</span>
            <div className="grid gap-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4"
                >
                  <input
                    value={form.instagram_urls[index] ?? ""}
                    onChange={(event) =>
                      setForm((current) => {
                        const nextInstagramUrls = [...current.instagram_urls];
                        nextInstagramUrls[index] = event.target.value;
                        return { ...current, instagram_urls: nextInstagramUrls };
                      })
                    }
                    placeholder="https://www.instagram.com/p/..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink"
                  />
                  {form.instagram_urls[index]?.trim() ? (
                    <InstagramEmbed
                      url={form.instagram_urls[index]}
                      compact
                      className="min-h-[160px]"
                    />
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                      링크를 입력하면 미리보기가 표시됩니다.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          </section>
        </form>
      </div>
    </div>
  );
}
