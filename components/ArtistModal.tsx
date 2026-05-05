"use client";

import { useEffect, useMemo, type ReactNode } from "react";

import { InstagramEmbed } from "@/components/InstagramEmbed";
import { TrackedArtistActionLink } from "@/components/TrackedArtistActionLink";
import type { Artist } from "@/lib/types";

type ArtistModalProps = {
  artist: Artist | null;
  onClose: () => void;
};

function formatCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

function isSafeHref(value: string) {
  return /^(https?:\/\/|mailto:)/i.test(value);
}

function renderMemoWithLinks(value: string) {
  const nodes: ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)|(https?:\/\/[^\s]+|mailto:[^\s]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (text: string) => {
    text.split("\n").forEach((line, index) => {
      if (index > 0) {
        nodes.push(<br key={`br-${nodes.length}`} />);
      }
      if (line) {
        nodes.push(line);
      }
    });
  };

  while ((match = linkRegex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      pushText(value.slice(lastIndex, match.index));
    }

    const label = match[1] ?? match[3];
    const href = match[2] ?? match[3];

    if (href && isSafeHref(href)) {
      nodes.push(
        <a
          key={`link-${nodes.length}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#ff4d6d] underline decoration-[#ff4d6d]/30 underline-offset-4 transition hover:text-[#c9153d]"
          onClick={(event) => event.stopPropagation()}
        >
          {label}
        </a>
      );
    } else if (match[0]) {
      pushText(match[0]);
    }

    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < value.length) {
    pushText(value.slice(lastIndex));
  }

  return nodes;
}

export function ArtistModal({ artist, onClose }: ArtistModalProps) {
  const galleryPostUrls = useMemo(() => {
    if (!artist) {
      return [];
    }

    return artist.gallery_post_urls.filter((url) => Boolean(url?.trim()));
  }, [artist]);

  useEffect(() => {
    if (!artist) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [artist, onClose]);

  if (!artist) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.5)] px-0 py-0 md:items-center md:px-6 md:py-8"
      onClick={onClose}
    >
      <div
        className="relative flex h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.2)] md:h-auto md:max-h-[90vh] md:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-[rgba(0,0,0,0.1)] bg-white px-3 py-2 text-sm font-semibold text-[#6b6b6b] shadow-sm transition hover:text-[#1a1a1a]"
        >
          닫기
        </button>

        <div className="grid h-full overflow-y-auto md:grid-cols-[0.92fr_1.08fr]">
          <div className="flex flex-col gap-6 border-b border-[rgba(0,0,0,0.08)] p-5 md:justify-between md:border-b-0 md:border-r md:p-8">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[#1a1a1a]">
                    {artist.name}
                  </h2>
                  {artist.is_ad && (
                    <span className="rounded-full border border-[#FFD740] bg-[#FFF8E1] px-3 py-0.5 text-[10px] font-bold text-[#7A5800]">
                      AD
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#a0a0a0]">{artist.genre} 작가</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {artist.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#efebff] px-3 py-1 text-xs font-semibold text-[#5a43d6]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] px-4 py-4">
                  <p className="text-[11px] text-[#a0a0a0]">팔로워</p>
                  <p className="mt-1 text-lg font-bold text-[#1a1a1a]">👥 {formatCount(artist.followers)}</p>
                </div>
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] px-4 py-4">
                  <p className="text-[11px] text-[#a0a0a0]">게시물 수</p>
                  <p className="mt-1 text-lg font-bold text-[#1a1a1a]">📚 {formatCount(artist.post_count)}</p>
                </div>
              </div>

              {artist.memo.trim() && (
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#fffaf3] px-4 py-4">
                  <p className="text-[11px] text-[#a0a0a0]">메모</p>
                  <p className="mt-2 text-sm leading-6 text-[#1a1a1a]">
                    {renderMemoWithLinks(artist.memo)}
                  </p>
                </div>
              )}
            </div>

            <TrackedArtistActionLink
              artistId={artist.id}
              eventType="instagram_click"
              href={`https://instagram.com/${artist.instagram_handle.replace(/^@/, "")}`}
              className="inline-flex items-center justify-center rounded-full bg-[#ff4d6d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#e83a5a]"
            >
              📸 인스타 바로가기
            </TrackedArtistActionLink>
          </div>

          <div className="space-y-4 p-4 md:overflow-y-auto md:p-6">
            {galleryPostUrls.length > 0 ? (
              galleryPostUrls.map((url, index) => (
                <div key={`${artist.id}-${index}`} className="space-y-3">
                  <InstagramEmbed
                    url={url}
                    className="min-h-[220px] rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white"
                  />
                  <TrackedArtistActionLink
                    artistId={artist.id}
                    eventType="embed_click"
                    href={url}
                    className="inline-flex items-center rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-4 py-2 text-sm font-semibold text-[#6b6b6b] transition hover:border-[#ff4d6d] hover:text-[#ff4d6d]"
                  >
                    게시물 보러가기 →
                  </TrackedArtistActionLink>
                </div>
              ))
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-[20px] border border-dashed border-[rgba(0,0,0,0.1)] bg-[#f8f7f4] text-center text-sm text-[#a0a0a0]">
                등록된 갤러리 게시물이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
