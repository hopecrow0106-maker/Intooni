import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { Images, UsersRound } from "lucide-react";

import { ArtistBackButton } from "@/components/ArtistBackButton";
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

export const revalidate = 3600;

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

function normalizeArtistSlug(value: string) {
  return decodeURIComponent(value).replace(/^@/, "").trim();
}

function getArtistSlug(artist: Pick<PublicArtistDTO, "id" | "instagram_handle">) {
  const handle = artist.instagram_handle.replace(/^@/, "").trim();
  return encodeURIComponent(handle || artist.id);
}

function buildArtistSeoDescription(artist: {
  name: string;
  instagram_handle: string;
  category: string;
  bio: string;
}) {
  const bioSummary = artist.bio.replace(/\s+/g, " ").trim();

  return bioSummary || `${artist.name} ${artist.category} 인스타툰 작가 프로필입니다.`;
}

const getArtistBySlug = cache(async (slug: string) => {
  const normalizedSlug = normalizeArtistSlug(slug);
  return getPublicArtistByHandle(normalizedSlug);
});

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
  const handle = artist.instagram_handle.replace(/^@/, "").trim();
  const pageUrl = `${getSiteUrl()}/artists/${canonicalSlug}`;
  const instagramProfileUrl = `https://www.instagram.com/${handle}/`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: pageUrl,
    name: `${artist.name} | ${artist.category} 작가 | ${SITE_NAME}`,
    description: seoDescription,
    dateCreated: artist.created_at || undefined,
    dateModified: artist.updated_at || artist.created_at || undefined,
    about: {
      "@type": "Person",
      name: artist.name,
      alternateName: `@${handle}`,
      description: artist.bio || seoDescription,
      image: artist.thumbnail_url || undefined,
      sameAs: [instagramProfileUrl]
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
        }}
      />
      <div className="min-w-0">
        <article className="space-y-7">
          <div>
            <ArtistBackButton />
          </div>

          <div className="grid gap-6 overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.06)] md:grid-cols-[220px_minmax(0,1fr)] md:p-6 lg:grid-cols-[220px_minmax(0,1fr)_minmax(300px,0.72fr)] lg:items-start lg:gap-8">
            {artist.thumbnail_url ? (
              <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-[18px] bg-[#f2f0ec] md:max-w-[220px]">
                <Image
                  src={artist.thumbnail_url}
                  alt={artist.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 220px"
                  priority
                />
              </div>
            ) : fallbackInstagramUrl ? (
              <InstagramEmbed
                url={fallbackInstagramUrl}
                className="min-h-[320px] rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.05)]"
              />
            ) : (
              <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-[18px] bg-[#f2f0ec] md:max-w-[220px]">
                <Image
                  src={ARTIST_SQUARE_PLACEHOLDER}
                  alt={artist.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 220px"
                  priority
                />
              </div>
            )}

            <div className="min-w-0 space-y-4">
              <div className="space-y-3">
                <h1 className="text-3xl font-extrabold text-[#1a1a1a] md:text-4xl">
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

              <section className="border-t border-[rgba(0,0,0,0.08)] pt-4">
                <h2 className="text-sm font-bold text-[#1a1a1a]">작가 소개</h2>
                {artist.bio.trim() ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#4b4b4b]">
                    {artist.bio}
                  </p>
                ) : null}
              </section>
            </div>

            <div className="space-y-4 md:col-span-2 lg:col-span-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] px-4 py-4">
                  <p className="text-[11px] text-[#a0a0a0]">팔로워</p>
                  <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-[#1a1a1a]">
                    <UsersRound
                      aria-hidden="true"
                      className="h-[20px] w-[20px] text-slate-700"
                      strokeWidth={2.2}
                    />
                    {formatOptionalCount(artist.stats.followers)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] px-4 py-4">
                  <p className="text-[11px] text-[#a0a0a0]">게시물 수</p>
                  <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-[#1a1a1a]">
                    <Images
                      aria-hidden="true"
                      className="h-[20px] w-[20px] text-slate-700"
                      strokeWidth={2.2}
                    />
                    {formatOptionalCount(artist.stats.post_count)}
                  </p>
                </div>
              </div>

              <TrackedArtistActionLink
                artistId={artist.id}
                eventType="instagram_outbound"
                href={instagramProfileUrl}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#ff4d6d] px-5 text-sm font-semibold text-white transition hover:bg-[#e83a5a]"
              >
                인스타그램 바로가기
              </TrackedArtistActionLink>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-[#1a1a1a]">인스타 게시물</h2>
              <span className="text-sm font-medium text-slate-400">총 {galleryPostUrls.length}개</span>
            </div>
            {galleryPostUrls.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                      className="inline-flex rounded-full bg-[#ff4d6d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e83a5a]"
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

    </main>
  );
}
