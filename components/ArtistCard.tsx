"use client";

import Image from "next/image";

import { InstagramEmbed } from "@/components/InstagramEmbed";
import { TrackedArtistActionLink } from "@/components/TrackedArtistActionLink";
import { ARTIST_SQUARE_PLACEHOLDER } from "@/lib/placeholders";
import type { Artist } from "@/lib/types";

type ArtistCardProps = {
  artist: Artist;
  index: number;
  onClick: () => void;
};

function formatSocialCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

export function ArtistCard({ artist, index, onClick }: ArtistCardProps) {
  const fallbackInstagramUrl = artist.gallery_post_urls.find((url) => url.trim());
  const detailHref = `/artists/${encodeURIComponent(artist.instagram_handle.replace(/^@/, "").trim())}`;

  return (
    <article
      className="group relative flex h-full w-full animate-fade-up flex-col overflow-hidden rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-white text-left opacity-0 transition-all duration-200 hover:-translate-y-1 hover:border-[rgba(0,0,0,0.15)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)]"
      style={{ animationDelay: `${index * 55}ms`, animationFillMode: "forwards" }}
    >
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={`${artist.name} 미리보기`}
      />
      <TrackedArtistActionLink
        artistId={artist.id}
        eventType="artist_click"
        href={detailHref}
        target="_self"
        className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[#1a1a1a] shadow-sm transition hover:border-[#ff4d6d] hover:text-[#c9153d]"
        aria-label={`${artist.name} 상세 페이지`}
        title="상세 페이지"
      >
        <span aria-hidden="true" className="text-lg leading-none">↗</span>
      </TrackedArtistActionLink>
      {artist.thumbnail_url ? (
        <div className="relative aspect-square overflow-hidden bg-[#f2f0ec]">
          <Image
            src={artist.thumbnail_url}
            alt={artist.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        </div>
      ) : fallbackInstagramUrl ? (
        <div className="relative aspect-square overflow-hidden bg-white">
          <div className="pointer-events-none absolute inset-x-0 top-0">
            <InstagramEmbed url={fallbackInstagramUrl} className="min-h-[420px] border-0" />
          </div>
        </div>
      ) : (
        <div className="relative aspect-square overflow-hidden bg-[#f2f0ec]">
          <Image
            src={ARTIST_SQUARE_PLACEHOLDER}
            alt={artist.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col px-3.5 pb-4 pt-3.5 sm:px-4 sm:pt-4">
        <div className="grid min-h-[42px] grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <h3
            className="line-clamp-2 text-[14px] font-bold leading-[1.4] text-[#1a1a1a] sm:text-[15px]"
            title={artist.name}
          >
            {artist.name}
          </h3>
          <span
            className="max-w-[54px] truncate pt-0.5 text-[11px] font-medium text-[#8a8a8a] sm:max-w-[72px] sm:text-xs"
            title={artist.genre}
          >
            {artist.genre}
          </span>
        </div>

        <div className="mt-2 flex h-[48px] content-start flex-wrap gap-1.5 overflow-hidden">
          {artist.hashtags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="h-6 max-w-full truncate rounded-full bg-[#efebff] px-2.5 py-1 text-[11px] font-semibold leading-4 text-[#5a43d6]"
              title={tag}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex min-h-9 items-center gap-3 border-t border-black/[0.06] pt-3 text-[11px] font-medium text-[#77738f] sm:text-xs">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            👥 {formatSocialCount(artist.followers)}
          </span>
          <span aria-hidden="true" className="h-3.5 w-px bg-black/10" />
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            📚 {formatSocialCount(artist.post_count)}
          </span>
        </div>
      </div>
    </article>
  );
}
