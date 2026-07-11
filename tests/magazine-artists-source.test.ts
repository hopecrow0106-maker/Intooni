import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const magazineDetailSource = readFileSync(
  path.resolve(__dirname, "../app/magazine/[id]/page.tsx"),
  "utf8"
);
const magazineRouteSource = readFileSync(
  path.resolve(__dirname, "../app/api/magazines/route.ts"),
  "utf8"
);

describe("magazine artist relationship wiring", () => {
  it("loads public related artists only through magazine_artists", () => {
    expect(magazineDetailSource).toContain('from("magazine_artists")');
    expect(magazineDetailSource).toContain('select("artist_id, sort_order")');
    expect(magazineDetailSource).toContain("listPublicArtistsByIds(relatedArtistIds)");
    expect(magazineDetailSource).not.toContain("related_artist_ids");
  });

  it("syncs admin magazine saves into the join table while keeping migration fallback", () => {
    expect(magazineRouteSource).toContain("async function syncMagazineArtists");
    expect(magazineRouteSource).toContain('from("magazine_artists")');
    expect(magazineRouteSource).toContain("related_artist_ids: relatedArtistIds");
    expect(magazineRouteSource).toContain("magazine_artists(artist_id, sort_order)");
    expect(magazineRouteSource).toContain(".update({ related_artist_ids: uniqueArtistIds })");
    expect(magazineRouteSource).toContain("isMissingMagazineArtistsTable");
  });
});
