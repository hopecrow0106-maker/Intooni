import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertNoForbiddenPublicArtistKeys, type PublicArtistDTO } from "@/lib/domain/public-artist";
import {
  getPublicArtistByHandle,
  listPublicArtists
} from "@/lib/server/public-artists";
import { GET as getPublicArtistList } from "@/app/api/public/artists/route";
import { GET as getPublicArtistDetail } from "@/app/api/public/artists/[handle]/route";

vi.mock("@/lib/server/public-artists", () => ({
  listPublicArtists: vi.fn(),
  getPublicArtistByHandle: vi.fn()
}));

const publicArtist: PublicArtistDTO = {
  id: "artist-1",
  name: "Public Artist",
  instagram_handle: "public_artist",
  category: "daily",
  bio: "Public bio",
  hashtags: ["daily"],
  search_tags: ["toon"],
  mood_tags: ["warm"],
  style_tags: ["essay"],
  topic_tags: ["work"],
  thumbnail_url: "https://example.com/thumb.png",
  character_url: "https://example.com/character.png",
  gallery_post_urls: ["https://www.instagram.com/p/example/"],
  is_trending: false,
  hide_from_new: false,
  sort_order: 1,
  created_at: "2026-07-11T00:00:00.000Z",
  updated_at: null,
  stats: {
    followers: 120,
    post_count: 12,
    followers_delta: 20,
    followers_growth_rate: 0.2,
    posts_delta: 2,
    posts_growth_rate: 0.2,
    latest_recorded_date: "2026-07-11",
    previous_recorded_date: "2026-07-04",
    comparison_interval_days: 7,
    is_weekly_comparable: true
  }
};

describe("public artist API routes", () => {
  beforeEach(() => {
    vi.mocked(listPublicArtists).mockReset();
    vi.mocked(getPublicArtistByHandle).mockReset();
  });

  it("returns list payloads without private or admin-only artist keys", async () => {
    vi.mocked(listPublicArtists).mockResolvedValue([publicArtist]);

    const response = await getPublicArtistList();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(payload).toEqual({ artists: [publicArtist] });
    expect(assertNoForbiddenPublicArtistKeys(payload)).toEqual([]);
  });

  it("returns detail payloads without private or admin-only artist keys", async () => {
    vi.mocked(getPublicArtistByHandle).mockResolvedValue(publicArtist);

    const response = await getPublicArtistDetail(new Request("https://intooni.com/api/public/artists/public_artist"), {
      params: { handle: "public_artist" }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getPublicArtistByHandle).toHaveBeenCalledWith("public_artist");
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(payload).toEqual({ artist: publicArtist });
    expect(assertNoForbiddenPublicArtistKeys(payload)).toEqual([]);
  });

  it("returns 404 for missing public artists", async () => {
    vi.mocked(getPublicArtistByHandle).mockResolvedValue(null);

    const response = await getPublicArtistDetail(new Request("https://intooni.com/api/public/artists/missing"), {
      params: { handle: "missing" }
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).not.toHaveProperty("artist");
  });

  it("does not expose database details in public error responses", async () => {
    vi.mocked(listPublicArtists).mockRejectedValue({
      message: "column internal_memo does not exist",
      details: "artist_contacts email",
      hint: "brand_safety_grade"
    });
    vi.mocked(getPublicArtistByHandle).mockRejectedValue({
      message: "private collaboration lookup failed",
      details: "email",
      hint: "internal_memo"
    });

    const listResponse = await getPublicArtistList();
    const detailResponse = await getPublicArtistDetail(
      new Request("https://intooni.com/api/public/artists/public_artist"),
      { params: { handle: "public_artist" } }
    );
    expect(await listResponse.json()).toEqual({
      message: "공개 작가 목록을 불러오지 못했습니다."
    });
    expect(await detailResponse.json()).toEqual({
      message: "공개 작가 정보를 불러오지 못했습니다."
    });
  });
});
