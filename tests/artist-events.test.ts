import { describe, expect, it } from "vitest";

import { normalizeArtistEventType } from "@/lib/artist-events";

describe("artist event normalization", () => {
  it.each([
    ["profile_click", "artist_click"],
    ["embed_click", "instagram_outbound"],
    ["hero_click", "artist_click"],
    ["toonbti_result_click", "artist_click"],
    ["toonbti_character_click", "artist_click"],
    ["random_click", "artist_click"],
    ["artist_click", "artist_click"],
    ["instagram_click", "instagram_outbound"],
    ["instagram_outbound", "instagram_outbound"]
  ] as const)("maps %s to %s", (input, expected) => {
    expect(normalizeArtistEventType(input)).toBe(expected);
  });
});
