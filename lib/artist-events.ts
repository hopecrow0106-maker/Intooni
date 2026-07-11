export const LEGACY_ARTIST_EVENT_TYPES = [
  "profile_click",
  "instagram_click",
  "embed_click",
  "hero_click",
  "toonbti_result_click",
  "toonbti_character_click",
  "random_click"
] as const;

export const DISPLAY_ARTIST_EVENT_TYPES = ["artist_click", "instagram_outbound"] as const;

export const ARTIST_EVENT_TYPES = [
  ...DISPLAY_ARTIST_EVENT_TYPES,
  ...LEGACY_ARTIST_EVENT_TYPES
] as const;

export type ArtistEventType = (typeof ARTIST_EVENT_TYPES)[number];
export type DisplayArtistEventType = (typeof DISPLAY_ARTIST_EVENT_TYPES)[number];

export const ARTIST_STATS_PERIODS = ["day", "week", "year", "all"] as const;
export type ArtistStatsPeriod = (typeof ARTIST_STATS_PERIODS)[number];

export type ArtistEventLog = {
  id: string;
  artist_id: string;
  event_type: ArtistEventType;
  created_at: string;
};

export type ArtistStatsSummary = {
  artist_id: string;
  artist_click: number;
  instagram_outbound: number;
};

export const EMPTY_ARTIST_STATS: Omit<ArtistStatsSummary, "artist_id"> = {
  artist_click: 0,
  instagram_outbound: 0
};

export function normalizeArtistEventType(eventType: ArtistEventType): DisplayArtistEventType {
  if (
    eventType === "instagram_click" ||
    eventType === "embed_click" ||
    eventType === "instagram_outbound"
  ) {
    return "instagram_outbound";
  }

  return "artist_click";
}

export function getArtistStatsThreshold(period: ArtistStatsPeriod) {
  const now = Date.now();

  switch (period) {
    case "day":
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case "week":
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "year":
      return new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
    case "all":
    default:
      return null;
  }
}
