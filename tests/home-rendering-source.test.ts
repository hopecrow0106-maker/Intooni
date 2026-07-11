import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const homeSource = readFileSync(path.join(root, "components/home/HomeClient.tsx"), "utf8");
const cardSource = readFileSync(path.join(root, "components/ArtistCard.tsx"), "utf8");

describe("home SSR rendering contracts", () => {
  it("uses deterministic initial ordering before client-side randomization", () => {
    expect(homeSource).toContain("createInitialOrderMap(initialHomeArtists)");
    expect(homeSource).toContain("pickInitialHeroDecorations(initialHomeArtists)");
    expect(homeSource).not.toContain("return shuffleItems(uniqueTags)");
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
    expect(homeSource).toContain("uniformHeight={false}");
    expect(homeSource).toContain('max-w-[1440px]');
  });

  it("keeps server-rendered artists when the client refresh is temporarily empty", () => {
    expect(homeSource).toContain(
      "const nextArtists = fetchedArtists.length > 0 ? fetchedArtists : initialHomeArtists"
    );
  });

  it("labels count-based growth as increase count", () => {
    expect(homeSource).toContain('{item === "count" ? "증가 수" : "비율"}');
    expect(homeSource).not.toContain('"갯수"');
  });
});
