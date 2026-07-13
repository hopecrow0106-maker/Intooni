import { describe, expect, it } from "vitest";

import {
  ARTIST_B2B_PROFILES_SHEET_HEADERS,
  ARTIST_COLLABORATIONS_SHEET_HEADERS,
  ARTIST_CONTACTS_SHEET_HEADERS,
  ARTIST_STATS_SHEET_HEADERS,
  ARTISTS_SHEET_HEADERS,
  BRAND_CATEGORIES_SHEET_HEADERS,
  CATEGORIES_SHEET_HEADERS,
  parseArtistStatsSheetValues,
  parseArtistSheetValues
} from "@/lib/sheets/artist-sheet";

describe("artist sheet parser", () => {
  it("keeps admin export headers aligned with the Google Sheet tabs", () => {
    expect(CATEGORIES_SHEET_HEADERS).toEqual(["category_id", "name", "sort_order", "updated_at"]);
    expect(BRAND_CATEGORIES_SHEET_HEADERS).toEqual(["brand_category_id", "name", "sort_order", "updated_at"]);
    expect(ARTIST_STATS_SHEET_HEADERS).toEqual([
      "artist_id",
      "recorded_date",
      "followers",
      "post_count"
    ]);
    expect(ARTIST_CONTACTS_SHEET_HEADERS).toEqual([
      "artist_id",
      "email",
      "dm_available",
      "source_updated_at"
    ]);
    expect(ARTIST_COLLABORATIONS_SHEET_HEADERS).toEqual([
      "collaboration_id",
      "artist_id",
      "brand_name",
      "brand_category_id",
      "brand_category_name",
      "collaboration_year",
      "collaboration_month",
      "post_url",
      "content_summary",
      "ad_disclosure_status",
      "likes",
      "comments",
      "views",
      "source_updated_at"
    ]);
    expect(ARTIST_B2B_PROFILES_SHEET_HEADERS).toEqual([
      "artist_id",
      "recommended_brand_categories",
      "strengths",
      "cautions",
      "brand_safety_grade",
      "source_updated_at"
    ]);
  });

  it("parses valid artist rows with pipe-delimited tags", () => {
    const rows = parseArtistSheetValues([
      [...ARTISTS_SHEET_HEADERS],
      [
        "artist-1",
        "  작가  ",
        "@Some_Handle",
        "category-1",
        "일상",
        "소개",
        "일상|썰툰",
        "검색|키워드",
        "귀여움",
        "담백함",
        "직장",
        "https://example.com/thumb.png",
        "https://example.com/character.png",
        "https://www.instagram.com/p/one/|https://www.instagram.com/p/two/",
        "true",
        "false",
        "yes",
        "no",
        "active",
        "7",
        "내부 메모",
        "2026-07-11T00:00:00.000Z",
        ""
      ]
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].action).toBe("update");
    expect(rows[0].record).toMatchObject({
      name: "작가",
      instagram_handle: "some_handle",
      main_category_id: "category-1",
      hashtags: ["#일상", "#썰툰"],
      search_tags: ["검색", "키워드"],
      show_on_site: true,
      show_growth_on_site: false,
      is_trending: true,
      hide_from_new: false,
      status: "active",
      sort_order: 7
    });
  });

  it("reports validation errors without dropping the row", () => {
    const invalidRow = ARTISTS_SHEET_HEADERS.map(() => "");
    invalidRow[ARTISTS_SHEET_HEADERS.indexOf("show_on_site")] = "maybe";
    invalidRow[ARTISTS_SHEET_HEADERS.indexOf("status")] = "published";
    invalidRow[ARTISTS_SHEET_HEADERS.indexOf("thumbnail_url")] = "not-a-url";
    invalidRow[ARTISTS_SHEET_HEADERS.indexOf("gallery_post_urls")] = "https://example.com/post";
    invalidRow[ARTISTS_SHEET_HEADERS.indexOf("source_updated_at")] = "yesterday";
    const rows = parseArtistSheetValues([
      [...ARTISTS_SHEET_HEADERS],
      invalidRow
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toContain("name is required");
    expect(rows[0].errors).toContain("instagram_handle is required");
    expect(rows[0].errors).toContain("show_on_site must be boolean");
    expect(rows[0].errors).toContain("status must be active, hidden, or archived");
    expect(rows[0].errors).toContain("thumbnail_url must be an HTTP(S) URL");
    expect(rows[0].errors).toContain("gallery_post_urls must contain Instagram post URLs");
    expect(rows[0].errors).toContain("source_updated_at must be an ISO timestamp");
  });

  it("reports duplicate instagram handles in the same sheet", () => {
    const validRow = [
      "",
      "",
      "작가",
      "@Same_Handle",
      "일상",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "true",
      "true",
      "false",
      "false",
      "active",
      "",
      "",
      "",
      ""
    ];
    const rows = parseArtistSheetValues([
      [...ARTISTS_SHEET_HEADERS],
      validRow,
      [...validRow, ""].map((value, index) => (index === 1 ? "다른 작가" : value))
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].errors).toContain("duplicate instagram_handle in sheet");
    expect(rows[1].errors).toContain("duplicate instagram_handle in sheet");
  });

  it("parses valid artist stats rows for explicit manual upsert", () => {
    const rows = parseArtistStatsSheetValues([
      [...ARTIST_STATS_SHEET_HEADERS],
      [
        "artist-1",
        "2026-07-10",
        "1,234",
        "56"
      ]
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].action).toBe("upsert");
    expect(rows[0].record).toMatchObject({
      artist_id: "artist-1",
      recorded_date: "2026-07-10",
      followers: 1234,
      post_count: 56
    });
  });

  it("reports invalid artist stats rows before apply can mutate official stats", () => {
    const rows = parseArtistStatsSheetValues([
      [...ARTIST_STATS_SHEET_HEADERS],
      ["", "20260710", "-1", "not-a-number"],
      ["", "20260710", "-1", "not-a-number"]
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].errors).toContain("artist_id is required");
    expect(rows[0].errors).toContain("recorded_date must be YYYY-MM-DD");
    expect(rows[0].errors).toContain("followers must be a non-negative integer");
    expect(rows[0].errors).toContain("post_count must be a number");
  });

  it("rejects impossible calendar dates in stats sheets", () => {
    const rows = parseArtistStatsSheetValues([
      [...ARTIST_STATS_SHEET_HEADERS],
      ["artist-1", "2026-02-31", "100", "20"]
    ]);

    expect(rows[0].errors).toContain("recorded_date must be YYYY-MM-DD");
  });
});
