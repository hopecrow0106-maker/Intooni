import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const layoutSource = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
const homeSource = readFileSync(path.join(root, "components/home/HomeClient.tsx"), "utf8");
const cardSource = readFileSync(path.join(root, "components/ArtistCard.tsx"), "utf8");
const instagramShowcaseSource = readFileSync(
  path.join(root, "components/InstagramArtistShowcase.tsx"),
  "utf8"
);

describe("home SSR rendering contracts", () => {
  it("uses deterministic initial ordering before client-side randomization", () => {
    expect(homeSource).toContain("createInitialOrderMap(initialHomeArtists)");
    expect(homeSource).toContain("pickInitialHeroDecorations(initialHomeArtists)");
    expect(homeSource).not.toContain("return shuffleItems(uniqueTags)");
  });

  it("prevents third-party embeds from creating page-level horizontal overflow", () => {
    expect(layoutSource).toContain("overflow-x-hidden antialiased");
    expect(instagramShowcaseSource).toContain("min-w-0 max-w-full overflow-hidden");
  });

  it("randomizes hero characters once per browser refresh", () => {
    expect(homeSource).toContain("pickRandomHeroDecorations");
    expect(homeSource).toContain("hasRandomizedHeroRef");
    expect(homeSource).toContain("setHeroDecorations(randomizedDecorations)");
    expect(homeSource).toContain(
      "current.length > 0 ? current : pickInitialHeroDecorations(nextArtists)"
    );
  });

  it("reshuffles the Instagram artist showcase at the top of every hour", () => {
    expect(homeSource).toContain("instagramArtistOrder");
    expect(homeSource).toContain("scheduleNextHourlyShuffle");
    expect(homeSource).toContain("nextHour.setMinutes(60, 0, 0)");
    expect(homeSource).toContain("setInstagramArtistOrder(createRandomOrderMap(allArtists))");
  });

  it("renders a real artist detail link in every artist card", () => {
    expect(cardSource).toContain('import { TrackedArtistActionLink }');
    expect(cardSource).toContain("href={detailHref}");
    expect(cardSource).toContain("encodeURIComponent(artist.instagram_handle");
    expect(cardSource).toContain('eventType="artist_click"');
  });

  it("normalizes profile-image cards without changing Instagram embed cards", () => {
    expect(cardSource).toContain("const PROFILE_IMAGE_SIZE = 720");
    expect(cardSource).toContain("usesFixedProfileLayout");
    expect(cardSource).toContain("usesUniformHeight");
    expect(cardSource).toContain("aspect-square");
    expect(cardSource).toContain('className="min-h-[220px] rounded-[16px]');
    expect(homeSource).toContain('max-w-[1440px]');
    expect(homeSource).toContain("<InstagramArtistFeatureCard");
  });

  it("keeps server-rendered artists when the client refresh is temporarily empty", () => {
    expect(homeSource).toContain(
      "const nextArtists = fetchedArtists.length > 0 ? fetchedArtists : initialHomeArtists"
    );
  });

  it("shows first Instagram posts with compact artist identity and count information", () => {
    expect(homeSource).toContain("featuredInstagramArtists");
    expect(homeSource).toContain("<InstagramArtistShowcase");
    expect(instagramShowcaseSource).toContain("getFirstInstagramPost");
    expect(instagramShowcaseSource).toContain("UsersRound");
    expect(instagramShowcaseSource).toContain("Images");
    expect(instagramShowcaseSource).toContain("artist.post_count");
    expect(instagramShowcaseSource).toContain("게시물");
    expect(instagramShowcaseSource).not.toContain("artist.bio");
    expect(instagramShowcaseSource).not.toContain("weekly_follower_growth");
    expect(instagramShowcaseSource).toContain("프로필 보기");
    expect(instagramShowcaseSource).toContain("xl:grid-cols-4");
    expect(instagramShowcaseSource).toContain('max-w-[1440px]');
    expect(homeSource).toContain('max-w-[1600px]');
    expect(homeSource).toContain("<InstagramArtistFeatureCard");
    expect(homeSource).not.toContain("AdSidebarPlaceholder");
    expect(homeSource).not.toContain("SectionBannerAd");
    expect(instagramShowcaseSource).toContain("PAGE_SIZE = 28");
    expect(instagramShowcaseSource).toContain("IntersectionObserver");
    expect(instagramShowcaseSource).not.toContain("{pageIndex + 1}페이지");
    expect(instagramShowcaseSource).toContain("다음 28명의 게시물을 불러오는 중");
  });

  it("labels count-based growth as increase count", () => {
    expect(homeSource).toContain('{item === "count" ? "증가 수" : "비율"}');
    expect(homeSource).not.toContain('"갯수"');
  });
});
