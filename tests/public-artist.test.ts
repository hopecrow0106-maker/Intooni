import { describe, expect, it } from "vitest";

import {
  assertNoForbiddenPublicArtistKeys,
  toPublicArtistDTO
} from "@/lib/domain/public-artist";

describe("public artist DTO", () => {
  it("does not include private or admin-only source keys", () => {
    const dto = toPublicArtistDTO(
      {
        id: "artist-1",
        name: "작가",
        instagram_handle: "@artist",
        category: "unused",
        genre: "일상",
        bio: "소개",
        hashtags: ["#일상"],
        hidden_tags: ["비밀검색어"],
        mood_tags: ["귀여움"],
        style_tags: ["담백함"],
        topic_tags: ["직장"],
        thumbnail_url: "https://example.com/thumb.png",
        character_url: "https://example.com/character.png",
        gallery_post_urls: ["https://www.instagram.com/p/example/"],
        is_hot: true,
        show_growth_on_site: true,
        followers: 100,
        post_count: 10,
        sort_order: 1,
        created_at: "2026-07-11T00:00:00.000Z",
        memo: "내부 메모",
        internal_memo: "진짜 내부 메모",
        email: "artist@example.com",
        status: "active",
        show_on_site: true
      } as never,
      [
        { recorded_date: "2026-07-11", followers: 120, post_count: 12 },
        { recorded_date: "2026-07-04", followers: 100, post_count: 10 }
      ]
    );

    expect(assertNoForbiddenPublicArtistKeys(dto)).toEqual([]);
    expect(dto.search_tags).toEqual(["비밀검색어"]);
    expect(dto.stats.followers_delta).toBe(20);
    expect(dto.stats.posts_delta).toBe(2);
  });

  it("hides growth values when show_growth_on_site is false", () => {
    const dto = toPublicArtistDTO(
      {
        id: "artist-2",
        name: "비공개 성장 작가",
        instagram_handle: "private_growth",
        genre: "공포",
        show_growth_on_site: false
      },
      [
        { recorded_date: "2026-07-11", followers: 120, post_count: 12 },
        { recorded_date: "2026-07-04", followers: 100, post_count: 10 }
      ]
    );

    expect(dto.stats.followers).toBe(120);
    expect(dto.stats.post_count).toBe(12);
    expect(dto.stats.followers_delta).toBeNull();
    expect(dto.stats.followers_growth_rate).toBeNull();
    expect(dto.stats.posts_delta).toBeNull();
    expect(dto.stats.posts_growth_rate).toBeNull();
  });

  it("keeps growth rates null when the previous value is zero", () => {
    const dto = toPublicArtistDTO(
      {
        id: "artist-3",
        name: "성장 작가",
        instagram_handle: "growth_artist",
        genre: "일상"
      },
      [
        { recorded_date: "2026-07-11", followers: 10, post_count: 2 },
        { recorded_date: "2026-07-04", followers: 0, post_count: 0 }
      ]
    );

    expect(dto.stats.followers_delta).toBe(10);
    expect(dto.stats.posts_delta).toBe(2);
    expect(dto.stats.followers_growth_rate).toBeNull();
    expect(dto.stats.posts_growth_rate).toBeNull();
    expect(dto.stats.comparison_interval_days).toBe(7);
    expect(dto.stats.is_weekly_comparable).toBe(true);
  });

  it("does not label a 14-day interval as weekly growth", () => {
    const dto = toPublicArtistDTO(
      {
        id: "artist-gap",
        name: "격주 수집 작가",
        instagram_handle: "two_week_artist",
        genre: "일상"
      },
      [
        { recorded_date: "2026-07-15", followers: 140, post_count: 14 },
        { recorded_date: "2026-07-01", followers: 100, post_count: 10 }
      ]
    );

    expect(dto.stats.followers).toBe(140);
    expect(dto.stats.comparison_interval_days).toBe(14);
    expect(dto.stats.is_weekly_comparable).toBe(false);
    expect(dto.stats.followers_delta).toBeNull();
    expect(dto.stats.followers_growth_rate).toBeNull();
    expect(dto.stats.posts_delta).toBeNull();
  });

  it("uses legacy current counts without inventing growth when no stat history exists", () => {
    const dto = toPublicArtistDTO({
      id: "artist-4",
      name: "기존 작가",
      instagram_handle: "legacy_artist",
      genre: "일상",
      followers: 30,
      post_count: 4
    });

    expect(dto.stats.followers).toBe(30);
    expect(dto.stats.post_count).toBe(4);
    expect(dto.stats.followers_delta).toBeNull();
    expect(dto.stats.posts_delta).toBeNull();
    expect(dto.stats.latest_recorded_date).toBeNull();
  });
});
