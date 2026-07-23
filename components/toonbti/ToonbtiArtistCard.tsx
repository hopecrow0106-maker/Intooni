"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PublicArtistDTO } from "@/lib/domain/public-artist";
import { ARTIST_SQUARE_PLACEHOLDER } from "@/lib/placeholders";

function sendEvent(payload: Record<string, string>) {
  void fetch("/api/toonbti-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
}

export function ToonbtiArtistCard({
  artist,
  testId,
  resultCode
}: {
  artist: PublicArtistDTO;
  testId: string;
  resultCode: string;
}) {
  const eventBase = { testId, resultCode, artistId: artist.id };
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative aspect-square bg-slate-100">
        <Image
          src={artist.thumbnail_url || artist.character_url || ARTIST_SQUARE_PLACEHOLDER}
          alt={`${artist.name} 프로필`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 300px"
        />
      </div>
      <div className="p-4">
        <p className="text-lg font-extrabold">{artist.name}</p>
        <p className="mt-1 text-sm text-slate-500">@{artist.instagram_handle}</p>
        {artist.bio ? (
          <p className="mt-3 line-clamp-2 whitespace-pre-line text-sm leading-6 text-slate-600">
            {artist.bio}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`/artists/${encodeURIComponent(artist.instagram_handle)}`}
            onClick={() => sendEvent({ ...eventBase, eventType: "toonbti_artist_click" })}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-700"
          >
            프로필 보기
          </Link>
          <a
            href={`https://www.instagram.com/${encodeURIComponent(artist.instagram_handle)}/`}
            target="_blank"
            rel="noreferrer"
            onClick={() => sendEvent({ ...eventBase, eventType: "toonbti_instagram_outbound" })}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md bg-[#ff4d6d] text-sm font-bold text-white"
          >
            Instagram
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </article>
  );
}
