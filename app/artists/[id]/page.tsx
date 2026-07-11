import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InstagramEmbed } from "@/components/InstagramEmbed";
import { TrackedArtistActionLink } from "@/components/TrackedArtistActionLink";
import type { PublicArtistDTO } from "@/lib/domain/public-artist";
import { ARTIST_SQUARE_PLACEHOLDER } from "@/lib/placeholders";
import { getSiteUrl, SITE_NAME } from "@/lib/site";
import { getPublicArtistByHandle } from "@/lib/server/public-artists";

type ArtistDetailPageProps = {
  params: {
    id: string;
  };
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

function formatOptionalCount(value: number | null) {
  return value === null ? "-" : formatCount(value);
}

function AdSidebarPlaceholder() {
  return (
    <div className="sticky top-20 flex min-h-[600px] w-[160px] items-center justify-center rounded-lg bg-gray-100">
      <span className="rotate-90 text-xs text-gray-400">광고 영역</span>
    </div>
  );
}

function normalizeArtistSlug(value: string) {
  return decodeURIComponent(value).replace(/^@/, "").trim();
}

function getArtistSlug(artist: Pick<PublicArtistDTO, "id" | "instagram_handle">) {
  const handle = artist.instagram_handle.replace(/^@/, "").trim();
  return encodeURIComponent(handle || artist.id);
}

function normalizeKeyword(value: string) {
  return value.replace(/^#/, "").trim();
}

function uniqueKeywords(values: string[]) {
  return Array.from(new Set(values.map(normalizeKeyword).filter(Boolean)));
}

function joinKoreanList(values: string[], fallback: string) {
  const keywords = uniqueKeywords(values).slice(0, 6);
  return keywords.length > 0 ? keywords.join(", ") : fallback;
}

function buildArtistSeoDescription(artist: {
  name: string;
  instagram_handle: string;
  category: string;
  bio: string;
  hashtags: string[];
  search_tags: string[];
  mood_tags: string[];
  style_tags: string[];
  topic_tags: string[];
}) {
  const handle = artist.instagram_handle.replace(/^@/, "").trim();
  const visibleKeywords = uniqueKeywords([
    ...artist.hashtags,
    ...artist.topic_tags,
    ...artist.style_tags,
    ...artist.mood_tags
  ]);
  const searchKeywords = joinKoreanList([...visibleKeywords, ...artist.search_tags], artist.category);
  const styleKeywords = joinKoreanList([...artist.style_tags, ...artist.mood_tags], artist.category);
  const topicKeywords = joinKoreanList([...artist.topic_tags, ...artist.hashtags], artist.category);
  const bio = artist.bio.trim();

  if (bio) {
    return `${artist.name}는 ${bio} 인스타툰 작가입니다. ${searchKeywords} 같은 키워드로 찾는 분들에게 추천되며, 인스타 아이디는 @${handle}입니다.`;
  }

  return `${artist.name}는 ${styleKeywords} 분위기와 ${topicKeywords} 주제를 다루는 ${artist.category} 인스타툰 작가입니다. 인스타 아이디는 @${handle}이며, 인투니에서 ${searchKeywords} 같은 해시태그와 키워드로 쉽게 찾을 수 있습니다.`;
}

async function getArtistBySlug(slug: string) {
  const normalizedSlug = normalizeArtistSlug(slug);
  return getPublicArtistByHandle(normalizedSlug);
}

export async function generateMetadata({
  params
}: ArtistDetailPageProps): Promise<Metadata> {
  const artist = await getArtistBySlug(params.id);

  if (!artist) {
    return {
      title: `작가를 찾을 수 없음 | ${SITE_NAME}`
    };
  }

  const description = buildArtistSeoDescription(artist);

  const image = artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER;
  const artistSlug = getArtistSlug(artist);
  const url = `${getSiteUrl()}/artists/${artistSlug}`;
  const title = `${artist.name} | ${artist.category} 작가 | ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/artists/${artistSlug}`
    },
    openGraph: {
      type: "article",
      locale: "ko_KR",
      siteName: SITE_NAME,
      url,
      title,
      description,
      images: [
        {
          url: image,
          alt: artist.name
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function ArtistDetailPage({ params }: ArtistDetailPageProps) {
  const artist = await getArtistBySlug(params.id);

  if (!artist) {
    notFound();
  }

  const currentSlug = normalizeArtistSlug(params.id);
  const canonicalSlug = getArtistSlug(artist);
  const canonicalComparable = normalizeArtistSlug(canonicalSlug);

  if (currentSlug !== canonicalComparable) {
    redirect(`/artists/${canonicalSlug}`);
  }

  const galleryPostUrls = artist.gallery_post_urls.filter((url) => url.trim());
  const fallbackInstagramUrl = galleryPostUrls[0];
  const seoDescription = buildArtistSeoDescription(artist);

  return (
    <main className="mx-auto w-full max-w-[1520px] px-4 py-8 md:px-6 md:py-12 xl:grid xl:grid-cols-[160px_minmax(0,1fr)_160px] xl:gap-8 xl:px-6">
      <aside className="hidden xl:block">
        <AdSidebarPlaceholder />
      </aside>

      <div className="min-w-0">
        <article className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← 홈으로
            </Link>
            <TrackedArtistActionLink
              artistId={artist.id}
              eventType="instagram_outbound"
              href={`https://instagram.com/${artist.instagram_handle.replace(/^@/, "")}`}
              className="inline-flex items-center rounded-full bg-[#ff4d6d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e83a5a]"
            >
              인스타 바로가기
            </TrackedArtistActionLink>
          </div>

          <div className="grid gap-6 overflow-hidden rounded-[28px] border border-[rgba(0,0,0,0.08)] bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.06)] md:grid-cols-[340px_minmax(0,1fr)] md:p-8">
            {artist.thumbnail_url ? (
              <div className="relative aspect-square overflow-hidden rounded-[24px] bg-[#f2f0ec]">
                <Image
                  src={artist.thumbnail_url}
                  alt={artist.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 340px"
                  priority
                />
              </div>
            ) : fallbackInstagramUrl ? (
              <InstagramEmbed
                url={fallbackInstagramUrl}
                className="min-h-[420px] rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.05)]"
              />
            ) : (
              <div className="relative aspect-square overflow-hidden rounded-[24px] bg-[#f2f0ec]">
                <Image
                  src={ARTIST_SQUARE_PLACEHOLDER}
                  alt={artist.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 340px"
                  priority
                />
              </div>
            )}

            <div className="space-y-5">
              <div className="space-y-3">
                <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[#1a1a1a] md:text-5xl">
                  {artist.name}
                </h1>
                <p className="text-base font-medium text-[#8a8a8a]">{artist.category} 작가</p>
                <div className="flex flex-wrap gap-2">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] px-4 py-4">
                  <p className="text-[11px] text-[#a0a0a0]">팔로워</p>
                  <p className="mt-1 text-xl font-bold text-[#1a1a1a]">
                    👥 {formatOptionalCount(artist.stats.followers)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] px-4 py-4">
                  <p className="text-[11px] text-[#a0a0a0]">게시물 수</p>
                  <p className="mt-1 text-xl font-bold text-[#1a1a1a]">
                    📚 {formatOptionalCount(artist.stats.post_count)}
                  </p>
                </div>
              </div>

              <section className="rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white px-4 py-4">
                <h2 className="text-sm font-bold text-[#1a1a1a]">작가 소개</h2>
                <p className="mt-2 text-sm leading-7 text-[#4b4b4b]">{seoDescription}</p>
              </section>
            </div>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-[#1a1a1a]">인스타 게시물</h2>
            {galleryPostUrls.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {galleryPostUrls.map((url, index) => (
                  <div key={`${artist.id}-${index}`} className="space-y-2">
                    <InstagramEmbed
                      url={url}
                      className="min-h-[360px] rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.05)]"
                    />
                    <TrackedArtistActionLink
                      artistId={artist.id}
                      eventType="instagram_outbound"
                      href={url}
                      className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-[#ff4d6d] hover:text-[#c9153d]"
                    >
                      게시물 보러가기
                    </TrackedArtistActionLink>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[rgba(0,0,0,0.1)] bg-[#f8f7f4] px-6 py-12 text-center text-sm text-[#8a8a8a]">
                등록된 인스타 게시물이 아직 없습니다.
              </div>
            )}
          </section>
        </article>
      </div>

      <aside className="hidden xl:block">
        <AdSidebarPlaceholder />
      </aside>
    </main>
  );
}
