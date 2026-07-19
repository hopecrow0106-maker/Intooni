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

  it("uses browser history for the back action", () => {
    const backButtonSource = readFileSync(
      path.resolve(__dirname, "../components/ArtistBackButton.tsx"),
      "utf8"
    );

    expect(pageSource).toContain("ArtistBackButton");
    expect(pageSource).not.toContain("← 홈으로");
    expect(backButtonSource).toContain("router.back()");
    expect(backButtonSource).toContain("뒤로가기");
  });

  it("serves cacheable, machine-readable artist profile pages", () => {
    expect(pageSource).toContain("export const revalidate = 3600");
    expect(pageSource).toContain("cache(async (slug: string)");
    expect(pageSource).toContain('type="application/ld+json"');
    expect(pageSource).toContain('"@type": "WebPage"');
    expect(pageSource).toContain('"@type": "Person"');
    expect(pageSource).toContain("sameAs: [instagramProfileUrl]");
  });

  it("shows the original public bio without exposing hidden search keywords", () => {
    expect(pageSource).toContain("whitespace-pre-line");
    expect(pageSource).toContain("{artist.bio}");
    expect(pageSource).not.toContain("buildArtistKeywordDescription");
    expect(pageSource).not.toContain("keywordDescription");
    expect(pageSource).not.toContain("키워드로 찾을 수 있는");
    expect(pageSource).not.toContain("search_tags");
    expect(pageSource).toContain('artist.bio.replace(/\\s+/g, " ").trim()');
  });

  it("does not render empty advertising sidebars around the artist profile", () => {
    expect(pageSource).not.toContain("AdSidebarPlaceholder");
    expect(pageSource).not.toContain("광고 영역");
    expect(pageSource).not.toContain("grid-cols-[160px_minmax(0,1fr)_160px]");
    expect(pageSource).toContain('max-w-[1440px]');
  });

  it("uses the same line icons as the public artist cards for follower and post counts", () => {
    expect(pageSource).toContain('import { Images, UsersRound } from "lucide-react"');
    expect(pageSource).toContain("<UsersRound");
    expect(pageSource).toContain("<Images");
    expect(pageSource).toContain("strokeWidth={2.2}");
    expect(pageSource).not.toContain("👥");
    expect(pageSource).not.toContain("📚");
  });

  it("uses a compact three-column desktop profile and a four-column post grid", () => {
    expect(pageSource).toContain(
      "lg:grid-cols-[220px_minmax(0,1fr)_minmax(300px,0.72fr)]"
    );
    expect(pageSource).toContain("max-w-[180px]");
    expect(pageSource).toContain("sm:max-w-[220px]");
    expect(pageSource).toContain("md:col-span-2 lg:col-span-1");
    expect(pageSource).toContain("sm:grid-cols-2 xl:grid-cols-4");
  });
});
