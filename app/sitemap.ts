import type { MetadataRoute } from "next";

import { getSupabasePublicServerClient } from "@/lib/supabase";

const SITE_URL = "https://intooni.com";

function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: absoluteUrl("/toonbti"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: absoluteUrl("/magazine"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7
    }
  ];

  try {
    const supabase = getSupabasePublicServerClient();
    const [{ data: artists }, { data: magazines }] = await Promise.all([
      supabase.from("artists").select("id, created_at"),
      supabase
        .from("magazines")
        .select("id, published_at, created_at")
        .eq("is_public", true)
    ]);

    const artistRoutes: MetadataRoute.Sitemap = (artists ?? []).map((artist) => ({
      url: absoluteUrl(`/artists/${artist.id}`),
      lastModified: artist.created_at ? new Date(artist.created_at) : now,
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
