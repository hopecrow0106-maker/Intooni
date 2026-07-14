import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  path.resolve(__dirname, "../app/artists/[id]/page.tsx"),
  "utf8"
);

describe("artist detail page source", () => {
  it("uses the public artist server layer instead of direct Supabase source-table reads", () => {
    expect(pageSource).toContain('getPublicArtistByHandle');
    expect(pageSource).toContain('PublicArtistDTO');
    expect(pageSource).not.toContain('getSupabaseAdminClient');
    expect(pageSource).not.toContain('getSupabasePublicServerClient');
    expect(pageSource).not.toContain('from("artists")');
    expect(pageSource).not.toContain("from('artists')");
    expect(pageSource).not.toContain('select("*")');
    expect(pageSource).not.toContain("select('*')");
  });

  it("does not reference private or admin-only artist fields in public detail rendering or metadata", () => {
    const forbiddenIdentifiers = [
      "email",
      "dm_available",
      "internal_memo",
      "memo",
      "collaborations",
      "recommended_brand_categories",
      "strengths",
      "cautions",
      "brand_safety_grade",
      "show_on_site",
      "show_growth_on_site",
      "status",
      "sheet_sync",
      "is_ad"
    ];

    for (const identifier of forbiddenIdentifiers) {
      expect(pageSource).not.toContain(identifier);
    }
  });

  it("records public Instagram profile and post links as instagram_outbound", () => {
    expect(pageSource).toContain("TrackedArtistActionLink");
    expect(pageSource.match(/eventType="instagram_outbound"/g)?.length).toBe(2);
    expect(pageSource).not.toContain('eventType="instagram_click"');
    expect(pageSource).not.toContain('eventType="embed_click"');
  });

  it("serves cacheable, machine-readable artist profile pages", () => {
    expect(pageSource).toContain("export const revalidate = 3600");
    expect(pageSource).toContain("cache(async (slug: string)");
    expect(pageSource).toContain('type="application/ld+json"');
    expect(pageSource).toContain('"@type": "WebPage"');
    expect(pageSource).toContain('"@type": "Person"');
    expect(pageSource).toContain("sameAs: [instagramProfileUrl]");
  });

  it("separates the original public bio from the generated keyword description", () => {
    expect(pageSource).toContain("buildArtistKeywordDescription");
    expect(pageSource).toContain("whitespace-pre-line");
    expect(pageSource).toContain("{artist.bio}");
    expect(pageSource).toContain("{keywordDescription}");
    expect(pageSource).toContain("키워드로 찾을 수 있는");
    expect(pageSource).toContain('artist.bio.replace(/\\s+/g, " ").trim()');
  });
});
