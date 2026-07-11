import { beforeEach, describe, expect, it, vi } from "vitest";

import sitemap from "@/app/sitemap";
import { listPublicArtists } from "@/lib/server/public-artists";
import { getSupabasePublicServerClient } from "@/lib/supabase";

vi.mock("@/lib/server/public-artists", () => ({
  listPublicArtists: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  getSupabasePublicServerClient: vi.fn()
}));

function mockMagazineQuery(data: Array<{ id: string; published_at: string | null; created_at: string | null }>) {
  vi.mocked(getSupabasePublicServerClient).mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data })
      }))
    }))
  } as never);
}

describe("sitemap", () => {
  beforeEach(() => {
    vi.mocked(listPublicArtists).mockReset();
    vi.mocked(getSupabasePublicServerClient).mockReset();
  });

  it("uses canonical URLs and the public artist layer for artist routes", async () => {
    vi.mocked(listPublicArtists).mockResolvedValue([
      {
        id: "public-artist",
        name: "Public Artist",
        instagram_handle: "public_handle",
        category: "daily",
        bio: "",
        hashtags: [],
        search_tags: [],
        mood_tags: [],
        style_tags: [],
        topic_tags: [],
        thumbnail_url: "",
        character_url: "",
        gallery_post_urls: [],
        is_trending: false,
        hide_from_new: false,
        sort_order: 0,
        created_at: "2026-07-11T00:00:00.000Z",
        updated_at: null,
        stats: {
          followers: null,
          post_count: null,
          followers_delta: null,
          followers_growth_rate: null,
          posts_delta: null,
          posts_growth_rate: null,
          latest_recorded_date: null,
          previous_recorded_date: null,
          comparison_interval_days: null,
          is_weekly_comparable: false
        }
      }
    ]);
    mockMagazineQuery([
      {
        id: "magazine-1",
        published_at: "2026-07-11T00:00:00.000Z",
        created_at: "2026-07-10T00:00:00.000Z"
      }
    ]);

    const routes = await sitemap();
    const urls = routes.map((route) => route.url);

    expect(urls).toContain("https://intooni.com/");
    expect(urls).toContain("https://intooni.com/artists/public_handle");
    expect(urls).toContain("https://intooni.com/magazine/magazine-1");
    expect(urls).not.toContain("https://intooni.com/artists/hidden_handle");
    expect(listPublicArtists).toHaveBeenCalledTimes(1);
  });

  it("falls back to static canonical routes if dynamic sitemap data cannot be loaded", async () => {
    vi.mocked(listPublicArtists).mockRejectedValue(new Error("database unavailable"));
    mockMagazineQuery([]);

    const routes = await sitemap();
    const urls = routes.map((route) => route.url);

    expect(urls).toEqual([
      "https://intooni.com/",
      "https://intooni.com/toonbti",
      "https://intooni.com/magazine"
    ]);
  });
});
