"use client";

import Image from "next/image";
import { ChevronRight, ImageOff, Images, Sparkles, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { InstagramEmbed } from "@/components/InstagramEmbed";
import { TrackedArtistActionLink } from "@/components/TrackedArtistActionLink";
import { ARTIST_SQUARE_PLACEHOLDER } from "@/lib/placeholders";
import type { Artist } from "@/lib/types";

type InstagramArtistShowcaseProps = {
  artists: Artist[];
  onArtistClick: (artist: Artist) => void;
};

const PAGE_SIZE = 28;
const INITIAL_EMBED_COUNT = 8;

function formatCount(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

function getFirstInstagramPost(artist: Artist) {
  return artist.gallery_post_urls.find((url) => url.trim()) ?? "";
}

export function InstagramArtistFeatureCard({
  artist,
  onArtistClick,
  eagerEmbed = false
}: {
  artist: Artist;
  onArtistClick: (artist: Artist) => void;
  eagerEmbed?: boolean;
}) {
  const postUrl = getFirstInstagramPost(artist);
  const detailHref = `/artists/${encodeURIComponent(artist.instagram_handle.replace(/^@/, "").trim())}`;
  const avatarUrl = artist.thumbnail_url || artist.character_url || ARTIST_SQUARE_PLACEHOLDER;
  const visibleTags = artist.hashtags.slice(0, 3);

  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(49,46,129,0.06)]">
      <div className="bg-slate-50 p-2">
        {postUrl ? (
          <InstagramEmbed
            url={postUrl}
            lazy={!eagerEmbed}
            className="!rounded-lg !border-0"
          />
        ) : (
          <div className="flex min-h-[520px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-slate-400">
            <ImageOff aria-hidden="true" className="h-8 w-8" strokeWidth={1.6} />
            <p className="mt-3 text-sm font-semibold">대표 게시물 준비 중</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 p-5">
        <button
          type="button"
          onClick={() => onArtistClick(artist)}
          className="flex w-full items-center gap-3 text-left"
        >
          <Image
            src={avatarUrl}
            alt={artist.name}
            width={52}
            height={52}
            className="h-[52px] w-[52px] shrink-0 rounded-full border border-slate-200 bg-slate-50 object-cover"
          />
          <span className="min-w-0">
            <strong className="block truncate text-[17px] font-bold text-slate-900">
              {artist.name}
            </strong>
            <span className="mt-0.5 block truncate text-sm text-slate-500">
              @{artist.instagram_handle.replace(/^@/, "")}
            </span>
          </span>
        </button>

        <div className="mt-4 flex min-h-[28px] flex-wrap gap-2">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="max-w-full truncate rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2 font-semibold">
            <UsersRound aria-hidden="true" className="h-[18px] w-[18px] text-slate-700" strokeWidth={2.2} />
            {formatCount(artist.followers)}
            <span className="font-normal text-slate-400">팔로워</span>
          </span>
          <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
          <span className="inline-flex items-center gap-2 font-semibold">
            <Images aria-hidden="true" className="h-[18px] w-[18px] text-slate-700" strokeWidth={2.2} />
            {formatCount(artist.post_count)}
            <span className="font-normal text-slate-400">게시물</span>
          </span>
        </div>

        <TrackedArtistActionLink
          artistId={artist.id}
          eventType="artist_click"
          href={detailHref}
          target="_self"
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-violet-400 text-sm font-bold text-violet-700 transition hover:bg-violet-50"
        >
          프로필 보기
          <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
        </TrackedArtistActionLink>
      </div>
    </article>
  );
}

export function InstagramArtistShowcase({
  artists,
  onArtistClick
}: InstagramArtistShowcaseProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [artists]);

  const visibleArtists = artists.slice(0, visibleCount);
  const hasMore = visibleCount < artists.length;
  const pages: Artist[][] = [];

  for (let index = 0; index < visibleArtists.length; index += PAGE_SIZE) {
    pages.push(visibleArtists.slice(index, index + PAGE_SIZE));
  }

  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) => Math.min(current + PAGE_SIZE, artists.length));
        }
      },
      { rootMargin: "1000px 0px" }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [artists.length, hasMore, visibleCount]);

  if (artists.length === 0) return null;

  return (
    <section
      data-instagram-showcase="true"
      className="mx-auto mb-14 max-w-[1440px] px-5 md:px-8"
    >
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950 md:text-[30px]">
            인스타툰 미리보기
          </h2>
          <p className="mt-2 text-sm text-slate-500 md:text-base">
            작가들의 첫 번째 대표 게시물과 프로필 정보를 함께 살펴보세요.
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-violet-600">{artists.length}명</span>
      </div>

      <div className="space-y-12">
        {pages.map((pageArtists, pageIndex) => {
          return (
            <div key={pageIndex}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                {pageArtists.map((artist, artistIndex) => {
                  const globalIndex = pageIndex * PAGE_SIZE + artistIndex;

                  return (
                    <InstagramArtistFeatureCard
                      key={artist.id}
                      artist={artist}
                      onArtistClick={onArtistClick}
                      eagerEmbed={globalIndex < INITIAL_EMBED_COUNT}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore ? (
        <div ref={loadMoreRef} className="mt-8 flex min-h-20 items-center justify-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            다음 28명의 게시물을 불러오는 중...
          </span>
        </div>
      ) : (
        <p className="mt-8 text-center text-sm font-medium text-slate-400">
          모든 공개 작가를 불러왔습니다.
        </p>
      )}
    </section>
  );
}
