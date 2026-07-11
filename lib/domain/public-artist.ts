export const FORBIDDEN_PUBLIC_ARTIST_KEYS = [
  "email",
  "dm_available",
  "internal_memo",
  "memo",
  "collaborations",
  "brand_name",
  "content_summary",
  "recommended_brand_categories",
  "strengths",
  "cautions",
  "brand_safety_grade",
  "risk",
  "show_on_site",
  "show_growth_on_site",
  "status",
  "sheet_sync",
  "is_ad"
] as const;

export type PublicArtistStats = {
  followers: number | null;
  post_count: number | null;
  followers_delta: number | null;
  followers_growth_rate: number | null;
  posts_delta: number | null;
  posts_growth_rate: number | null;
  latest_recorded_date: string | null;
  previous_recorded_date: string | null;
  comparison_interval_days: number | null;
  is_weekly_comparable: boolean;
};

export type PublicArtistDTO = {
  id: string;
  name: string;
  instagram_handle: string;
  category: string;
  bio: string;
  hashtags: string[];
  search_tags: string[];
  mood_tags: string[];
  style_tags: string[];
  topic_tags: string[];
  thumbnail_url: string;
  character_url: string;
  gallery_post_urls: string[];
  is_trending: boolean;
  hide_from_new: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  stats: PublicArtistStats;
};

type PublicArtistSourceRow = {
  id: string;
  name: string;
  instagram_handle: string;
  bio?: string | null;
  hashtags?: string[] | null;
  search_tags?: string[] | null;
  hidden_tags?: string[] | null;
  mood_tags?: string[] | null;
  style_tags?: string[] | null;
  topic_tags?: string[] | null;
  thumbnail_url?: string | null;
  character_url?: string | null;
  gallery_post_urls?: string[] | null;
  is_trending?: boolean | null;
  is_hot?: boolean | null;
  hide_from_new?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  genre?: string | null;
  main_category?: { name?: string | null } | null;
  categories?: { name?: string | null } | null;
  show_growth_on_site?: boolean | null;
  followers?: number | null;
  post_count?: number | null;
};

type PublicArtistStatRow = {
  followers: number;
  post_count: number;
  recorded_date: string;
};

function normalizeHandle(value: string) {
  return value.replace(/^@/, "").trim().toLowerCase();
}

function arrayValue(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function growthRate(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return null;
  }

  return (current - previous) / previous;
}

function dateIntervalDays(latest?: string | null, previous?: string | null) {
  if (!latest || !previous) return null;
  const latestTime = Date.parse(`${latest}T00:00:00.000Z`);
  const previousTime = Date.parse(`${previous}T00:00:00.000Z`);
  if (!Number.isFinite(latestTime) || !Number.isFinite(previousTime)) return null;
  const days = Math.round((latestTime - previousTime) / 86_400_000);
  return days > 0 ? days : null;
}

function buildStats({
  latest,
  previous,
  showGrowth,
  legacyFollowers,
  legacyPostCount
}: {
  latest?: PublicArtistStatRow | null;
  previous?: PublicArtistStatRow | null;
  showGrowth: boolean;
  legacyFollowers?: number | null;
  legacyPostCount?: number | null;
}): PublicArtistStats {
  const followers = latest?.followers ?? legacyFollowers ?? null;
  const postCount = latest?.post_count ?? legacyPostCount ?? null;
  const previousFollowers = previous?.followers ?? null;
  const previousPostCount = previous?.post_count ?? null;
  const comparisonIntervalDays = dateIntervalDays(latest?.recorded_date, previous?.recorded_date);
  const isComparable = comparisonIntervalDays !== null;

  if (!showGrowth) {
    return {
      followers,
      post_count: postCount,
      followers_delta: null,
      followers_growth_rate: null,
      posts_delta: null,
      posts_growth_rate: null,
      latest_recorded_date: latest?.recorded_date ?? null,
      previous_recorded_date: previous?.recorded_date ?? null,
      comparison_interval_days: comparisonIntervalDays,
      is_weekly_comparable: false
    };
  }

  return {
    followers,
    post_count: postCount,
    followers_delta:
      isComparable && followers !== null && previousFollowers !== null
        ? followers - previousFollowers
        : null,
    followers_growth_rate: isComparable ? growthRate(followers, previousFollowers) : null,
    posts_delta:
      isComparable && postCount !== null && previousPostCount !== null
        ? postCount - previousPostCount
        : null,
    posts_growth_rate: isComparable ? growthRate(postCount, previousPostCount) : null,
    latest_recorded_date: latest?.recorded_date ?? null,
    previous_recorded_date: previous?.recorded_date ?? null,
    comparison_interval_days: comparisonIntervalDays,
    is_weekly_comparable: isComparable
  };
}

export function toPublicArtistDTO(
  row: PublicArtistSourceRow,
  stats: PublicArtistStatRow[] = []
): PublicArtistDTO {
  const sortedStats = [...stats].sort((left, right) =>
    right.recorded_date.localeCompare(left.recorded_date)
  );
  const latest = sortedStats[0] ?? null;
  const previous = sortedStats[1] ?? null;
  const category = row.main_category?.name ?? row.categories?.name ?? row.genre ?? "";
  const showGrowth = row.show_growth_on_site !== false;

  return {
    id: row.id,
    name: row.name,
    instagram_handle: normalizeHandle(row.instagram_handle),
    category,
    bio: row.bio ?? "",
    hashtags: arrayValue(row.hashtags),
    search_tags: arrayValue(row.search_tags ?? row.hidden_tags),
    mood_tags: arrayValue(row.mood_tags),
    style_tags: arrayValue(row.style_tags),
    topic_tags: arrayValue(row.topic_tags),
    thumbnail_url: row.thumbnail_url ?? "",
    character_url: row.character_url ?? "",
    gallery_post_urls: arrayValue(row.gallery_post_urls),
    is_trending: row.is_trending ?? row.is_hot ?? false,
    hide_from_new: row.hide_from_new ?? false,
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? null,
    stats: buildStats({
      latest,
      previous,
      showGrowth,
      legacyFollowers: row.followers,
      legacyPostCount: row.post_count
    })
  };
}

export function assertNoForbiddenPublicArtistKeys(value: unknown) {
  const text = JSON.stringify(value);
  return FORBIDDEN_PUBLIC_ARTIST_KEYS.filter((key) => text.includes(`"${key}"`));
}
