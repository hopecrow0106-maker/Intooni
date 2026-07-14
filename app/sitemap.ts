import type { MetadataRoute } from "next";

import { listPublicArtists } from "@/lib/server/public-artists";
import { CANONICAL_SITE_URL } from "@/lib/site";
import { getSupabasePublicServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function absoluteUrl(path: string) {
  return new URL(path, CANONICAL_SITE_URL).toString();
}

function getArtistSlug(artist: { id: string; instagram_handle: string }) {
  const handle = artist.instagram_handle.replace(/^@/, "").trim();
  return encodeURIComponent(handle || artist.id);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: absoluteUrl("/toonbti"),
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: absoluteUrl("/magazine"),
      changeFrequency: "weekly",
      priority: 0.7
    }
  ];

  try {
    const supabase = getSupabasePublicServerClient();
    const [artists, { data: magazines }] = await Promise.all([
      listPublicArtists(),
      supabase
        .from("magazines")
        .select("id, published_at, created_at")
        .eq("is_public", true)
    ]);

    const artistRoutes: MetadataRoute.Sitemap = artists.map((artist) => ({
      url: absoluteUrl(`/artists/${getArtistSlug(artist)}`),
      lastModified: artist.updated_at
        ? new Date(artist.updated_at)
        : artist.created_at
          ? new Date(artist.created_at)
          : now,
      changeFrequency: "weekly",
      priority: 0.6
    }));

    const magazineRoutes: MetadataRoute.Sitemap = (magazines ?? []).map((magazine) => ({
      url: absoluteUrl(`/magazine/${magazine.id}`),
      lastModified: magazine.published_at
        ? new Date(magazine.published_at)
        : magazine.created_at
          ? new Date(magazine.created_at)
          : now,
      changeFrequency: "monthly",
      priority: 0.65
    }));

    return [...staticRoutes, ...artistRoutes, ...magazineRoutes];
  } catch {
    return staticRoutes;
  }
}
