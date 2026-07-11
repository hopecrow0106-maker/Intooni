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

  it("keeps artist cards on a fixed square and equal-height layout", () => {
    expect(cardSource).toContain("flex h-full w-full");
    expect(cardSource).toContain("aspect-square");
    expect(cardSource).toContain('min-h-[42px]');
    expect(cardSource).toContain('h-[48px]');
    expect(cardSource).toContain("mt-auto");
    expect(homeSource).toContain('max-w-[1440px]');
  });
});
