"use client";

import { useEffect, useMemo } from "react";
import { Images, UsersRound } from "lucide-react";

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
                </div>
                <p className="text-sm text-[#a0a0a0]">{artist.genre} 작가</p>
                {artist.bio.trim() ? (
                  <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] px-4 py-3">
                    <p className="text-[11px] font-semibold text-[#8a8a8a]">작가 프로필</p>
                    <p className="mt-1 whitespace-pre-wrap break-keep text-sm leading-6 text-[#4b4b4b]">{artist.bio.trim()}</p>
                  </div>
                ) : null}
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
                  <p className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-[#1a1a1a]">
                    <UsersRound
                      aria-hidden="true"
                      className="h-[20px] w-[20px] text-slate-700"
                      strokeWidth={2.2}
                    />
                    {formatCount(artist.followers)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] px-4 py-4">
                  <p className="text-[11px] text-[#a0a0a0]">게시물 수</p>
                  <p className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-[#1a1a1a]">
                    <Images
                      aria-hidden="true"
                      className="h-[20px] w-[20px] text-slate-700"
                      strokeWidth={2.2}
                    />
                    {formatCount(artist.post_count)}
                  </p>
                </div>
              </div>

            </div>

            <TrackedArtistActionLink
              artistId={artist.id}
              eventType="instagram_outbound"
              href={`https://instagram.com/${artist.instagram_handle.replace(/^@/, "")}`}
              className="inline-flex items-center justify-center rounded-full bg-[#ff4d6d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#e83a5a]"
            >
              📸 인스타 바로가기
            </TrackedArtistActionLink>
          </div>

          <div className="space-y-4 p-4 md:overflow-y-auto md:p-6">
            {galleryPostUrls.length > 0 ? (
              galleryPostUrls.map((url, index) => (
                <div
                  key={`${artist.id}-${index}`}
                  className="mx-auto w-full max-w-[440px] space-y-3"
                >
                  <InstagramEmbed
                    url={url}
                    className="min-h-[220px] rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white"
                  />
                  <TrackedArtistActionLink
                    artistId={artist.id}
                    eventType="instagram_outbound"
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
