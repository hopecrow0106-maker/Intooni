"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

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
    published_at: formatDateInput(magazine?.published_at)
  };
}

function buildImageToken(url: string, size: "wide" | "medium") {
  return `\n\n{{image:${url}|${size}}}\n\n`;
}

function buildTextToken(
  value: string,
  size: "body" | "large",
  align: "left" | "center" | "right"
) {
  return `\n\n{{text:${value}|${size}|${align}}}\n\n`;
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
  const [formMessage, setFormMessage] = useState("");
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setForm(createInitialState(initialMagazine));
    setUploading({ thumbnail: false, inlineImage: false });
    setFormMessage("");
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

  const selectedArtistSet = useMemo(
    () => new Set(form.related_artist_ids),
    [form.related_artist_ids]
  );

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

  return (
    <div className="fixed inset-0 z-50 bg-ink/50" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 h-[94vh] overflow-y-auto rounded-t-[32px] bg-[#fffdf9] p-5 shadow-[0_-24px_70px_rgba(16,24,40,0.24)] md:left-auto md:right-6 md:top-6 md:h-auto md:max-h-[calc(100vh-3rem)] md:w-[760px] md:rounded-[32px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-coral">Magazine Form</p>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">
              {initialMagazine ? "매거진 수정" : "매거진 추가"}
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
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setFormMessage("");

            await onSave({
              ...form,
              instagram_urls: form.instagram_urls.map((url) => url.trim()).filter(Boolean).slice(0, 4),
              published_at: new Date(`${form.published_at}T00:00:00`).toISOString()
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
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium text-slate-600">커버 이미지</span>
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <div className="relative aspect-[2/1] overflow-hidden rounded-[24px] border border-dashed border-slate-200 bg-slate-50">
                {form.thumbnail_url ? (
                  <Image
                    src={form.thumbnail_url}
                    alt="매거진 커버"
                    fill
                    className="object-cover"
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
                        error instanceof Error
                          ? error.message
                          : "매거진 커버 업로드에 실패했습니다."
                      );
                    } finally {
                      setUploading((current) => ({ ...current, thumbnail: false }));
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600">본문</span>
            <textarea
              ref={contentTextareaRef}
              required
              rows={12}
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
            />
          </label>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">본문 블록 삽입</p>
                <p className="mt-1 text-xs text-slate-400">
                  이미지와 텍스트 블록을 본문 커서 위치에 바로 넣을 수 있습니다.
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
              <p className="text-sm font-semibold text-slate-700">텍스트 블록 삽입</p>
              <p className="mt-1 text-xs text-slate-400">
                큰 글씨와 앞/중간/뒤 정렬 문장을 본문 사이에 바로 넣을 수 있습니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    insertContentToken(buildTextToken("큰 제목을 입력하세요", "large", "left"))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  큰 글씨
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
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-slate-400">
              <p>{"{{image:URL|wide}}"} / {"{{image:URL|medium}}"} 형식으로 이미지가 저장됩니다.</p>
              <p>
                {"{{text:문장|large|left}}"} 또는 {"{{text:문장|body|center}}"} 형식으로 텍스트가
                저장됩니다.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium text-slate-600">관련 작가 선택</span>
            <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 md:grid-cols-2">
              {artists.map((artist) => (
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
              ))}
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
                    <InstagramEmbed url={form.instagram_urls[index]} compact className="min-h-[160px]" />
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                      링크를 입력하면 미리보기가 표시됩니다.
                    </div>
                  )}
                </div>
              ))}
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

          <button
            type="submit"
            disabled={isBusy}
            className="w-full rounded-full bg-ink px-5 py-4 text-sm font-semibold text-white transition hover:bg-coral disabled:cursor-wait disabled:opacity-70"
          >
            {isBusy ? "저장 중..." : "저장하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
