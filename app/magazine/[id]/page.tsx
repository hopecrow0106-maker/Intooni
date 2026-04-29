import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InstagramEmbed } from "@/components/InstagramEmbed";
import { ARTIST_SQUARE_PLACEHOLDER, MAGAZINE_RECT_PLACEHOLDER } from "@/lib/placeholders";
import { getSupabaseAdminClient, getSupabasePublicServerClient } from "@/lib/supabase";
import type { Artist } from "@/lib/types";

type MagazineDetailPageProps = {
  params: {
    id: string;
  };
};

type ContentBlock =
  | { type: "paragraph"; value: string }
  | {
      type: "text";
      value: string;
      size: "small" | "body" | "large" | "title";
      align: "left" | "center" | "right";
      bold: boolean;
    }
  | { type: "image"; url: string; size: "wide" | "medium" }
  | { type: "divider" };

function sortArtistsByIds(artists: Artist[], ids: string[]) {
  const orderMap = new Map(ids.map((id, index) => [id, index]));
  return [...artists].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
}

function getArtistSlug(artist: { id: string; instagram_handle: string }) {
  const handle = artist.instagram_handle.replace(/^@/, "").trim();
  return encodeURIComponent(handle || artist.id);
}

function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const tokenRegex =
    /\{\{divider\}\}|\{\{(image|text):(.+?)\|(wide|medium|small|body|large|title)(?:\|(left|center|right))?(?:\|(bold|normal))?\}\}/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index).trim();
    if (before) {
      blocks.push({ type: "paragraph", value: before });
    }

    if (match[0] === "{{divider}}") {
      blocks.push({ type: "divider" });
    } else if (match[1] === "image") {
      blocks.push({
        type: "image",
        url: match[2],
        size: match[3] as "wide" | "medium"
      });
    } else {
      blocks.push({
        type: "text",
        value: match[2],
        size: match[3] as "small" | "body" | "large" | "title",
        align: (match[4] as "left" | "center" | "right" | undefined) ?? "left",
        bold: match[5] === "bold"
      });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  const tail = content.slice(lastIndex).trim();
  if (tail) {
    blocks.push({ type: "paragraph", value: tail });
  }

  return blocks;
}

function AdSidebarPlaceholder() {
  return <div className="sticky top-20 min-h-[600px] w-[160px] rounded-lg bg-gray-100/40" />;
}

function getTextBlockClass(
  size: "small" | "body" | "large" | "title",
  align: "left" | "center" | "right",
  bold: boolean
) {
  const sizeClass = {
    small: "text-[13px] leading-7 text-slate-500",
    body: "text-[15px] leading-8 text-slate-700",
    large: "text-[22px] leading-[1.45] tracking-[-0.03em] text-[#1a1a1a] md:text-[28px]",
    title: "text-[30px] leading-[1.25] tracking-[-0.04em] text-[#1a1a1a] md:text-[42px]"
  }[size];

  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return `${sizeClass} ${bold || size === "title" ? "font-extrabold" : ""} ${alignClass}`;
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

  const contentBlocks = parseContent(magazine.content);
  const instagramUrls = magazine.instagram_urls.filter((url) => url.trim()).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-[1520px] px-4 py-8 md:px-6 md:py-12 xl:grid xl:grid-cols-[160px_minmax(0,1fr)_160px] xl:gap-8 xl:px-6">
      <aside className="hidden xl:block">
        <AdSidebarPlaceholder />
      </aside>

      <div className="min-w-0">
        <article className="mx-auto max-w-5xl space-y-8">
          <div className="overflow-hidden rounded-[28px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.06)]">
            <div className="relative aspect-[2/1] bg-[#f2f0ec]">
              <Image
                src={magazine.thumbnail_url || MAGAZINE_RECT_PLACEHOLDER}
                alt={magazine.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
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

                if (block.type === "text") {
                  return (
                    <div
                      key={`text-${index}`}
                      className={getTextBlockClass(block.size, block.align, block.bold)}
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

                return (
                  <div
                    key={`image-${index}`}
                    className={block.size === "wide" ? "space-y-2" : "mx-auto max-w-2xl space-y-2"}
                  >
                    <div className="relative overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-[#f2f0ec] shadow-[0_12px_28px_rgba(0,0,0,0.05)]">
                      <div className={block.size === "wide" ? "relative aspect-[16/9]" : "relative aspect-[4/5]"}>
                        <Image
                          src={block.url}
                          alt={`${magazine.title} 본문 이미지 ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes={
                            block.size === "wide"
                              ? "(max-width: 1024px) 100vw, 1024px"
                              : "(max-width: 768px) 100vw, 640px"
                          }
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
                    className="min-h-[420px] rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.05)]"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </article>
      </div>

      <aside className="hidden xl:block">
        <AdSidebarPlaceholder />
      </aside>
    </main>
  );
}
