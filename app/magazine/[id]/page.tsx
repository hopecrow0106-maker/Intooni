/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GoogleAd } from "@/components/GoogleAd";
import { InstagramEmbed } from "@/components/InstagramEmbed";
import { ADSENSE_SLOTS } from "@/lib/adsense";
import {
  getMagazineContentStats,
  parseMagazineContent,
  sanitizeMagazineHtml,
  type CalloutTone,
  type ImageBlockSize,
  type TextBlockFont
} from "@/lib/magazine-content";
import { ARTIST_SQUARE_PLACEHOLDER, MAGAZINE_RECT_PLACEHOLDER } from "@/lib/placeholders";
import { getSupabaseAdminClient, getSupabasePublicServerClient } from "@/lib/supabase";
import type { Artist } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MagazineDetailPageProps = {
  params: {
    id: string;
  };
};

function sortArtistsByIds(artists: Artist[], ids: string[]) {
  const orderMap = new Map(ids.map((id, index) => [id, index]));
  return [...artists].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
}

function getArtistSlug(artist: { id: string; instagram_handle: string }) {
  const handle = artist.instagram_handle.replace(/^@/, "").trim();
  return encodeURIComponent(handle || artist.id);
}

function AdSidebar({ side }: { side: "left" | "right" }) {
  return (
    <GoogleAd
      slot={side === "left" ? ADSENSE_SLOTS.leftSidebar : ADSENSE_SLOTS.rightSidebar}
      label={side === "left" ? "데스크톱 왼쪽 광고" : "데스크톱 오른쪽 광고"}
      className="sticky top-20 min-h-[600px] w-[160px]"
      format="vertical"
      fullWidthResponsive={false}
    />
  );
}

function getTextBlockClass(
  size: "small" | "body" | "large" | "title",
  align: "left" | "center" | "right",
  bold: boolean,
  font: TextBlockFont,
  strike: boolean
) {
  const sizeClass = {
    small: "text-[13px] leading-7 text-slate-500",
    body: "text-[15px] leading-8 text-slate-700",
    large: "text-[22px] leading-[1.45] tracking-[-0.03em] text-[#1a1a1a] md:text-[28px]",
    title: "text-[30px] leading-[1.25] tracking-[-0.04em] text-[#1a1a1a] md:text-[42px]"
  }[size];

  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const fontClass =
    font === "serif" ? "font-serif" : font === "mono" ? "font-mono" : "";
  const decorationClass = strike ? "line-through decoration-2" : "";

  return `${sizeClass} ${bold || size === "title" ? "font-extrabold" : ""} ${alignClass} ${fontClass} ${decorationClass}`;
}

function getImageBlockClass(size: ImageBlockSize) {
  return {
    full: "mx-auto max-w-[820px] space-y-2",
    wide: "mx-auto max-w-[760px] space-y-2",
    medium: "mx-auto max-w-[560px] space-y-2"
  }[size];
}

function getCalloutClass(tone: CalloutTone) {
  return {
    note: "border-slate-200 bg-slate-50 text-slate-700",
    tip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  }[tone];
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatFollowerCount(value: number) {
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(1).replace(/\.0$/, "")}만`;
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

export default async function MagazineDetailPage({ params }: MagazineDetailPageProps) {
  const publicSupabase = getSupabasePublicServerClient();
  const adminSupabase = getSupabaseAdminClient();

  const { data: magazine, error: magazineError } = await publicSupabase
    .from("magazines")
    .select("*")
    .eq("id", params.id)
    .eq("is_public", true)
    .single();

  if (magazineError || !magazine) {
    notFound();
  }

  await adminSupabase
    .from("magazines")
    .update({ view_count: magazine.view_count + 1 })
    .eq("id", params.id);

  let relatedArtists: Artist[] = [];
  if (magazine.related_artist_ids.length > 0) {
    const { data: artists } = await publicSupabase
      .from("artists")
      .select("*")
      .in("id", magazine.related_artist_ids);

    relatedArtists = sortArtistsByIds(artists ?? [], magazine.related_artist_ids);
  }

  const contentBlocks = parseMagazineContent(magazine.content);
  const contentStats = getMagazineContentStats(magazine.content);
  const instagramUrls = magazine.instagram_urls.filter((url) => url.trim()).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-[1520px] px-4 py-8 md:px-6 md:py-12 xl:grid xl:grid-cols-[160px_minmax(0,1fr)_160px] xl:gap-8 xl:px-6">
      <aside className="hidden xl:block">
        <AdSidebar side="left" />
      </aside>

      <div className="min-w-0">
        <article className="mx-auto max-w-[820px] space-y-8">
          <div className="mx-auto max-w-[640px] overflow-hidden rounded-[28px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.06)]">
            <div className="aspect-square bg-[#f2f0ec]">
              <img
                src={magazine.thumbnail_url || MAGAZINE_RECT_PLACEHOLDER}
                alt={magazine.title}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="space-y-4">
            {magazine.tag ? (
              <span className="inline-flex rounded-full bg-[#fff0f3] px-4 py-2 text-sm font-semibold text-[#c9153d]">
                {magazine.tag}
              </span>
            ) : null}
            <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[#1a1a1a] md:text-5xl">
              {magazine.title}
            </h1>
            <p className="text-sm font-medium text-slate-400">
              {formatDate(magazine.published_at)} · 약 {contentStats.readingMinutes}분 읽기
            </p>
          </div>

          <div className="rounded-[28px] border border-[rgba(0,0,0,0.08)] bg-white px-5 py-6 shadow-[0_16px_40px_rgba(0,0,0,0.04)] md:px-8 md:py-8">
            <div className="space-y-6">
              {contentBlocks.map((block, index) => {
                if (block.type === "paragraph") {
                  return (
                    <p
                      key={`paragraph-${index}`}
                      className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700"
                    >
                      {block.value}
                    </p>
                  );
                }

                if (block.type === "html") {
                  return (
                    <div
                      key={`html-${index}`}
                      className="magazine-rich-preview text-[15px] leading-8 text-slate-700"
                      dangerouslySetInnerHTML={{ __html: sanitizeMagazineHtml(block.value) }}
                    />
                  );
                }

                if (block.type === "text") {
                  return (
                    <div
                      key={`text-${index}`}
                      className={getTextBlockClass(
                        block.size,
                        block.align,
                        block.bold,
                        block.font,
                        block.strike
                      )}
                    >
                      <p className="whitespace-pre-wrap">{block.value}</p>
                    </div>
                  );
                }

                if (block.type === "divider") {
                  return (
                    <div key={`divider-${index}`} className="py-4">
                      <div className="h-px w-full bg-slate-200" />
                    </div>
                  );
                }

                if (block.type === "quote") {
                  return (
                    <blockquote
                      key={`quote-${index}`}
                      className="border-l-4 border-[#ff4d6d] bg-[#fff8fa] px-5 py-4 text-[18px] font-semibold leading-8 text-[#1a1a1a] md:px-6 md:py-5"
                    >
                      <p className="whitespace-pre-wrap">{block.value}</p>
                      {block.cite ? (
                        <cite className="mt-3 block text-sm not-italic text-slate-500">
                          - {block.cite}
                        </cite>
                      ) : null}
                    </blockquote>
                  );
                }

                if (block.type === "callout") {
                  return (
                    <div
                      key={`callout-${index}`}
                      className={`rounded-[22px] border px-5 py-4 ${getCalloutClass(block.tone)}`}
                    >
                      <p className="text-sm font-extrabold">{block.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7">{block.value}</p>
                    </div>
                  );
                }

                if (block.type === "list") {
                  if (block.style === "number") {
                    return (
                      <ol
                        key={`list-${index}`}
                        className="list-decimal space-y-2 pl-6 text-[15px] leading-8 text-slate-700"
                      >
                        {block.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    );
                  }

                  if (block.style === "check") {
                    return (
                      <ul key={`list-${index}`} className="space-y-3 text-[15px] leading-8 text-slate-700">
                        {block.items.map((item) => (
                          <li key={item} className="flex gap-3">
                            <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
                              ✓
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }

                  return (
                    <ul key={`list-${index}`} className="list-disc space-y-2 pl-6 text-[15px] leading-8 text-slate-700">
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  );
                }

                if (block.type === "instagram") {
                  return (
                    <div key={`instagram-${index}`} className="mx-auto max-w-xl">
                      <InstagramEmbed
                        url={block.url}
                        className="max-h-[360px] min-h-[260px] rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.05)]"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={`image-${index}`}
                    className={getImageBlockClass(block.size)}
                  >
                    <div className="overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-[#f2f0ec] shadow-[0_12px_28px_rgba(0,0,0,0.05)]">
                      <div>
                        <img
                          src={block.url}
                          alt={`${magazine.title} 본문 이미지 ${index + 1}`}
                          className="h-auto max-h-[680px] w-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {relatedArtists.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[#1a1a1a]">관련 작가</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {relatedArtists.map((artist) => (
                  <Link
                    key={artist.id}
                    href={`/artists/${getArtistSlug(artist)}`}
                    className="overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white text-left transition hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(0,0,0,0.08)]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#f2f0ec]">
                      <Image
                        src={artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER}
                        alt={artist.name}
                        fill
                        className="object-cover"
                        sizes="240px"
                      />
                    </div>
                    <div className="space-y-1 px-4 pb-4 pt-3">
                      <p className="text-sm font-bold text-[#1a1a1a]">{artist.name}</p>
                      <p className="text-xs text-[#8a8a8a]">
                        {artist.genre} · {formatFollowerCount(artist.followers)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {instagramUrls.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[#1a1a1a]">인스타 임베드</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {instagramUrls.map((url, index) => (
                  <InstagramEmbed
                    key={`${magazine.id}-${index}`}
                    url={url}
                    className="max-h-[360px] min-h-[260px] rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.05)]"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </article>
      </div>

      <aside className="hidden xl:block">
        <AdSidebar side="right" />
      </aside>
    </main>
  );
}
