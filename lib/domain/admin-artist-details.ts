import { isIsoCalendarDate } from "@/lib/normalize";

export type AdminArtistStat = {
  id: string;
  artist_id: string;
  recorded_date: string;
  followers: number;
  post_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminArtistContact = {
  artist_id: string;
  email: string | null;
  dm_available: boolean | null;
};

export type AdminArtistCollaboration = {
  id: string;
  artist_id: string;
  brand_name: string;
  brand_category_id: string | null;
  brand_category_name: string | null;
  collaboration_year: number;
  collaboration_month: number | null;
  post_url: string;
  content_summary: string;
  ad_disclosure_status: "yes" | "no" | "unknown";
  likes: number | null;
  comments: number | null;
  views: number | null;
  created_at: string;
  updated_at: string;
};

export type AdminArtistB2bProfile = {
  artist_id: string;
  strengths: string;
  cautions: string;
  brand_safety_grade: "unknown" | "safe" | "normal" | "caution" | null;
  brand_category_ids: string[];
};

export type AdminBrandCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type AdminArtistDetails = {
  stats: AdminArtistStat[];
  contact: AdminArtistContact | null;
  collaborations: AdminArtistCollaboration[];
  b2b: AdminArtistB2bProfile | null;
  brand_categories: AdminBrandCategory[];
};

export function isIsoDate(value: string) {
  return isIsoCalendarDate(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isInstagramPostUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase()) &&
      /^\/(p|reel|tv)\/[^/]+\/?/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function calculateCumulativeStatGrowth(stats: AdminArtistStat[]) {
  const sorted = [...stats].sort(
    (left, right) => Date.parse(right.recorded_date) - Date.parse(left.recorded_date)
  );
  const latest = sorted[0];
  if (!latest) return null;
  const earliest = sorted[sorted.length - 1];
  const intervalDays = Math.max(
    0,
    Math.round(
      (Date.parse(`${latest.recorded_date}T00:00:00Z`) -
        Date.parse(`${earliest.recorded_date}T00:00:00Z`)) /
        86_400_000
    )
  );
  const followersDelta = latest.followers - earliest.followers;
  const postsDelta = latest.post_count - earliest.post_count;
  return {
    record_count: sorted.length,
    first_recorded_date: earliest.recorded_date,
    latest_recorded_date: latest.recorded_date,
    interval_days: intervalDays,
    followers_delta: followersDelta,
    followers_growth_rate:
      earliest.followers === 0 ? null : followersDelta / earliest.followers,
    posts_delta: postsDelta,
    posts_growth_rate:
      earliest.post_count === 0 ? null : postsDelta / earliest.post_count
  };
}
