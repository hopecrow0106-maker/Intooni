import type { Metadata } from "next";
import Link from "next/link";

import HomeClient from "@/components/home/HomeClient";
import { orderArtistsForHalfHour } from "@/lib/half-hourly-artist-order";
import { listPublicArtists } from "@/lib/server/public-artists";
import { listPublicMagazines } from "@/lib/server/public-magazines";
import { CANONICAL_SITE_URL } from "@/lib/site";
import { getSupabasePublicServerClient } from "@/lib/supabase";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

const homeOgImageUrl = `${CANONICAL_SITE_URL}/og-home-v2.png`;
const homeSearchThumbnailUrl = `${CANONICAL_SITE_URL}/intooni-search-thumbnail-v1.png`;

const homeStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${CANONICAL_SITE_URL}/#webpage`,
  url: CANONICAL_SITE_URL,
  name: "인투니 | 기억 안 나는 인스타툰 찾기",
  description:
    "작가 이름이 생각 안 날 때, 해시태그와 키워드로 인스타툰 작가를 찾아보세요.",
  inLanguage: "ko-KR",
  primaryImageOfPage: {
    "@type": "ImageObject",
    "@id": `${CANONICAL_SITE_URL}/#primaryimage`,
    url: homeSearchThumbnailUrl,
    contentUrl: homeSearchThumbnailUrl,
    width: 912,
    height: 912,
    caption: "인투니"
  },
  thumbnailUrl: homeSearchThumbnailUrl,
  isPartOf: {
    "@type": "WebSite",
    "@id": `${CANONICAL_SITE_URL}/#website`,
    url: CANONICAL_SITE_URL,
    name: "인투니",
    inLanguage: "ko-KR"
  }
};

export const metadata: Metadata = {
  alternates: {
    canonical: CANONICAL_SITE_URL
  },
  openGraph: {
    url: CANONICAL_SITE_URL,
    images: [
      {
        url: homeOgImageUrl,
        width: 1200,
        height: 630,
        alt: "인투니 - 기억 안 나는 인스타툰 찾기"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    images: [homeOgImageUrl]
  }
};

async function getPublicCategories() {
  try {
    const supabase = getSupabasePublicServerClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  } catch {
    return [] as Category[];
  }
}

function artistPath(handle: string) {
  return `/artists/${encodeURIComponent(handle.replace(/^@/, "").trim())}`;
}

function shuffleForHeroRender<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

export default async function HomePage() {
  const [artists, categories, magazines] = await Promise.all([
    listPublicArtists().catch(() => []),
    getPublicCategories(),
    listPublicMagazines().catch(() => [])
  ]);
  const orderedArtists = orderArtistsForHalfHour(artists);
  const heroArtists = shuffleForHeroRender(artists);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeStructuredData).replace(/</g, "\\u003c")
        }}
      />
      <HomeClient
        initialArtists={orderedArtists}
        initialHeroArtists={heroArtists}
        initialCategories={categories}
        initialMagazines={magazines}
      />
      <noscript>
        <nav aria-label="인투니 작가 링크">
          <ul>
            {artists.map((artist) => (
              <li key={artist.id}>
                <Link href={artistPath(artist.instagram_handle)}>
                  {artist.name} · {artist.category} · @{artist.instagram_handle.replace(/^@/, "")}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </noscript>
    </>
  );
}
