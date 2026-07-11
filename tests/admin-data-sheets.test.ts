import { describe, expect, it } from "vitest";

import {
  parseArtistB2bProfileSheetValues,
  parseArtistCollaborationSheetValues,
  parseArtistContactSheetValues,
  parseCategorySheetValues
} from "@/lib/sheets/admin-data-sheets";
import {
  ARTIST_B2B_PROFILES_SHEET_HEADERS,
  ARTIST_COLLABORATIONS_SHEET_HEADERS,
  ARTIST_CONTACTS_SHEET_HEADERS,
  CATEGORIES_SHEET_HEADERS
} from "@/lib/sheets/artist-sheet";

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ARTIST_ID = "44444444-4444-4444-8444-444444444444";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const COLLABORATION_ID = "33333333-3333-4333-8333-333333333333";

describe("general admin sheet parsers", () => {
  it("normalizes category names and rejects normalized duplicates", () => {
    const rows = parseCategorySheetValues(
      [
        [...CATEGORIES_SHEET_HEADERS],
        [CATEGORY_ID, "  일상  ", "1", "2026-07-11T00:00:00.000Z"],
        ["", "일상", "2", ""]
      ],
      "categories"
    );

    expect(rows[0].record?.name).toBe("일상");
    expect(rows[0].errors).toContain("duplicate normalized name in sheet");
    expect(rows[1].errors).toContain("duplicate normalized name in sheet");
  });

  it("parses tri-state contact data and validates email", () => {
    const rows = parseArtistContactSheetValues([
      [...ARTIST_CONTACTS_SHEET_HEADERS],
      [ARTIST_ID, "artist@example.com", "", "2026-07-11T00:00:00.000Z"],
      [OTHER_ARTIST_ID, "not-an-email", "maybe", ""]
    ]);

    expect(rows[0].record?.dm_available).toBeNull();
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toContain("email is invalid");
    expect(rows[1].errors).toContain("dm_available must be true, false, or blank");
  });

  it("validates collaboration ids, dates, metrics, disclosure, and Instagram URLs", () => {
    const rows = parseArtistCollaborationSheetValues([
      [...ARTIST_COLLABORATIONS_SHEET_HEADERS],
      [
        COLLABORATION_ID,
        ARTIST_ID,
        "브랜드",
        CATEGORY_ID,
        "식품",
        "2026",
        "7",
        "https://www.instagram.com/p/example/",
        "신제품 캠페인 릴스",
        "yes",
        "10",
        "2",
        "100",
        "2026-07-11T00:00:00.000Z"
      ],
      ["", ARTIST_ID, "", "", "", "1999", "13", "https://example.com/post", "", "maybe", "-1"]
    ]);

    expect(rows[0].errors).toEqual([]);
    expect(rows[0].record?.collaboration_year).toBe(2026);
    expect(rows[0].record?.content_summary).toBe("신제품 캠페인 릴스");
    expect(rows[1].errors).toContain("brand_name is required");
    expect(rows[1].errors).toContain("post_url must be an Instagram post URL");
    expect(rows[1].errors).toContain("collaboration_year must be at least 2000");
    expect(rows[1].errors).toContain("collaboration_month must be at most 12");
    expect(rows[1].errors).toContain("likes must be at least 0");
  });

  it("parses B2B category lists and restricts brand safety values", () => {
    const rows = parseArtistB2bProfileSheetValues([
      [...ARTIST_B2B_PROFILES_SHEET_HEADERS],
      [ARTIST_ID, " 식품 | 뷰티 | 식품 ", "강점", "주의", "safe", ""],
      [OTHER_ARTIST_ID, "", "", "", "danger", ""]
    ]);

    expect(rows[0].record?.recommended_brand_categories).toEqual(["식품", "뷰티"]);
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toContain(
      "brand_safety_grade must be unknown, safe, normal, or caution"
    );
  });
});
