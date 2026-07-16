import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const sources = {
  card: readFileSync(path.join(root, "components/ArtistCard.tsx"), "utf8"),
  modal: readFileSync(path.join(root, "components/ArtistModal.tsx"), "utf8"),
  home: readFileSync(path.join(root, "components/home/HomeClient.tsx"), "utf8"),
  magazine: readFileSync(path.join(root, "app/magazine/[id]/page.tsx"), "utf8"),
  toonbti: readFileSync(path.join(root, "components/toonbti/ToonTestRunner.tsx"), "utf8"),
  adminTable: readFileSync(path.join(root, "components/admin/ArtistTable.tsx"), "utf8"),
  adminForm: readFileSync(path.join(root, "components/admin/ArtistForm.tsx"), "utf8")
};

describe("public artist event wiring", () => {
  it("uses artist_click for cards, random/home opens, magazine relations, and ToonBTI results", () => {
    expect(sources.card).toContain('eventType="artist_click"');
    expect(sources.home).toContain('eventType: "artist_click"');
    expect(sources.magazine).toContain('eventType="artist_click"');
    expect(sources.toonbti).toContain('eventType="artist_click"');
  });

  it("uses instagram_outbound for public Instagram profile and post actions", () => {
    expect(sources.modal.match(/eventType="instagram_outbound"/g)?.length).toBe(2);
    expect(sources.modal).toContain("max-w-[440px]");
  });

  it("does not track Admin Instagram preview/profile actions", () => {
    expect(sources.adminTable).not.toContain("/api/artist-events");
    expect(sources.adminForm).not.toContain("/api/artist-events");
    expect(sources.adminTable).not.toContain("TrackedArtistActionLink");
    expect(sources.adminForm).not.toContain("TrackedArtistActionLink");
  });
});
