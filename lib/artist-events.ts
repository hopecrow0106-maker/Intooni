export const ARTIST_EVENT_TYPES = [
  "profile_click",
  "instagram_click",
  "embed_click",
  "hero_click"
] as const;

export type ArtistEventType = (typeof ARTIST_EVENT_TYPES)[number];

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
  profile_click: number;
  instagram_click: number;
  embed_click: number;
  hero_click: number;
};

export const EMPTY_ARTIST_STATS: Omit<ArtistStatsSummary, "artist_id"> = {
  profile_click: 0,
  instagram_click: 0,
  embed_click: 0,
  hero_click: 0
};

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

