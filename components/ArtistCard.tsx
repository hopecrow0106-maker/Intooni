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
      className="group relative w-full animate-fade-up overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white text-left opacity-0 transition-all duration-200 hover:-translate-y-1 hover:border-[rgba(0,0,0,0.15)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)]"
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
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f2f0ec]">
          <Image
            src={artist.thumbnail_url}
            alt={artist.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        </div>
      ) : fallbackInstagramUrl ? (
        <div className="bg-white p-2">
          <InstagramEmbed
            url={fallbackInstagramUrl}
            className="min-h-[220px] rounded-[16px] border border-[rgba(0,0,0,0.08)]"
          />
        </div>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f2f0ec]">
          <Image
            src={ARTIST_SQUARE_PLACEHOLDER}
            alt={artist.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        </div>
      )}

      <div className="space-y-2 px-3.5 pb-4 pt-3">
        <div>
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="text-[14px] font-bold leading-tight tracking-[-0.02em] text-[#1a1a1a]">
              {artist.name}
            </h3>
            <span className="shrink-0 text-[11px] font-medium text-[#a0a0a0]">{artist.genre}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {artist.hashtags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#efebff] px-2.5 py-0.5 text-[11px] font-semibold text-[#5a43d6]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3 text-[11px] font-medium text-[#8f87c8]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f0ff] px-2.5 py-1">
            👥 {formatSocialCount(artist.followers)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f7f3ff] px-2.5 py-1 text-[#a39abf]">
            📚 {formatSocialCount(artist.post_count)}
          </span>
        </div>
      </div>
    </article>
  );
}
