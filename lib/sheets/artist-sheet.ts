import {
  isIsoCalendarDate,
  normalizeInstagramHandle,
  normalizeTagList,
  normalizeText
} from "@/lib/normalize";

export const ARTISTS_SHEET_NAME = "artists";

export const ARTISTS_SHEET_HEADERS = [
  "artist_id",
  "name",
  "instagram_handle",
  "main_category_id",
  "main_category_name",
  "bio",
  "hashtags",
  "search_tags",
  "mood_tags",
  "style_tags",
  "topic_tags",
  "thumbnail_url",
  "character_url",
  "gallery_post_urls",
  "show_on_site",
  "show_growth_on_site",
  "is_trending",
  "hide_from_new",
  "status",
  "sort_order",
  "internal_memo",
  "source_updated_at"
] as const;

export const CATEGORIES_SHEET_HEADERS = ["category_id", "name", "sort_order", "updated_at"] as const;
export const BRAND_CATEGORIES_SHEET_HEADERS = ["brand_category_id", "name", "sort_order", "updated_at"] as const;
export const ARTIST_STATS_SHEET_HEADERS = [
  "artist_id",
  "recorded_date",
  "followers",
  "post_count"
] as const;
export const ARTIST_CONTACTS_SHEET_HEADERS = [
  "artist_id",
  "email",
  "dm_available",
  "source_updated_at"
] as const;
export const ARTIST_COLLABORATIONS_SHEET_HEADERS = [
  "collaboration_id",
  "artist_id",
  "brand_name",
  "brand_category_id",
  "brand_category_name",
  "collaboration_year",
  "collaboration_month",
  "post_url",
  "content_summary",
  "ad_disclosure_status",
  "likes",
  "comments",
  "views",
  "source_updated_at"
] as const;
export const ARTIST_B2B_PROFILES_SHEET_HEADERS = [
  "artist_id",
  "recommended_brand_categories",
  "strengths",
  "cautions",
  "brand_safety_grade",
  "source_updated_at"
] as const;

export type ArtistSheetRecord = {
  artist_id: string;
  name: string;
  instagram_handle: string;
  main_category_id: string;
  main_category_name: string;
  bio: string;
  hashtags: string[];
  search_tags: string[];
  mood_tags: string[];
  style_tags: string[];
  topic_tags: string[];
  thumbnail_url: string;
  character_url: string;
  gallery_post_urls: string[];
  show_on_site: boolean;
  show_growth_on_site: boolean;
  is_trending: boolean;
  hide_from_new: boolean;
  status: "active" | "hidden" | "archived";
  sort_order: number | null;
  internal_memo: string;
  source_updated_at: string;
};

export type ArtistSheetPreviewRow = {
  rowNumber: number;
  action: "create" | "update" | "skip";
  record: ArtistSheetRecord | null;
  errors: string[];
};

export type ArtistStatsSheetRecord = {
  artist_id: string;
  recorded_date: string;
  followers: number | null;
  post_count: number | null;
};

export type ArtistStatsSheetPreviewRow = {
  rowNumber: number;
  action: "upsert" | "skip";
  record: ArtistStatsSheetRecord | null;
  errors: string[];
};

const TRUE_VALUES = new Set(["true", "1", "yes", "y", "on", "예", "네", "공개"]);
const FALSE_VALUES = new Set(["false", "0", "no", "n", "off", "아니오", "비공개"]);
const ARTIST_STATUSES = new Set(["active", "hidden", "archived"]);

function valueAt(row: string[], headerIndex: Map<string, number>, key: string) {
  const index = headerIndex.get(key);
  return index === undefined ? "" : String(row[index] ?? "");
}

function splitPipe(value: string) {
  return normalizeTagList(
    value
      .split("|")
      .map((item) => item.replace(/^#/, ""))
      .filter(Boolean)
  );
}

function splitHashtags(value: string) {
  return splitPipe(value).map((tag) => `#${tag}`);
}

function parseBoolean(value: string, fallback: boolean, errors: string[], label: string) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  errors.push(`${label} must be boolean`);
  return fallback;
}

function parseNumber(value: string, errors: string[], label: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const number = Number(normalized.replace(/,/g, ""));
  if (!Number.isFinite(number)) {
    errors.push(`${label} must be a number`);
    return null;
  }

  return number;
}

function parseNonNegativeInteger(value: string, errors: string[], label: string) {
  const number = parseNumber(value, errors, label);
  if (number === null) {
    return null;
  }

  if (!Number.isInteger(number) || number < 0) {
    errors.push(`${label} must be a non-negative integer`);
    return null;
  }

  return number;
}

function isIsoDate(value: string) {
  return isIsoCalendarDate(value);
}

function isHttpUrl(value: string) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isInstagramPostUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return /(^|\.)instagram\.com$/i.test(url.hostname) && /^\/(p|reel|tv)\//.test(url.pathname);
  } catch {
    return false;
  }
}

function isEmptyRow(row: string[]) {
  return row.every((value) => !String(value ?? "").trim());
}

export function rowsToObjects(headers: string[], rows: string[][]) {
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "")]))
  );
}

export function parseArtistSheetValues(values: string[][]): ArtistSheetPreviewRow[] {
  const [headers = [], ...rows] = values;
  const normalizedHeaders = headers.map((header) => normalizeText(String(header)));
  const headerIndex = new Map(normalizedHeaders.map((header, index) => [header, index]));
  const missingHeaders = ARTISTS_SHEET_HEADERS.filter((header) => !headerIndex.has(header));
  const handleCounts = rows.reduce<Map<string, number>>((counts, row) => {
    if (isEmptyRow(row)) {
      return counts;
    }

    const handle = normalizeInstagramHandle(valueAt(row, headerIndex, "instagram_handle"));
    if (!handle) {
      return counts;
    }

    counts.set(handle, (counts.get(handle) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return rows
    .map((row, index): ArtistSheetPreviewRow => {
      const rowNumber = index + 2;
      if (isEmptyRow(row)) {
        return { rowNumber, action: "skip", record: null, errors: [] };
      }

      const errors = missingHeaders.map((header) => `missing header: ${header}`);
      const artistId = normalizeText(valueAt(row, headerIndex, "artist_id"));
      const name = normalizeText(valueAt(row, headerIndex, "name"));
      const instagramHandle = normalizeInstagramHandle(valueAt(row, headerIndex, "instagram_handle"));
      const statusValue = normalizeText(valueAt(row, headerIndex, "status") || "active") || "active";

      if (!name) {
        errors.push("name is required");
      }

      if (!instagramHandle) {
        errors.push("instagram_handle is required");
      } else if ((handleCounts.get(instagramHandle) ?? 0) > 1) {
        errors.push("duplicate instagram_handle in sheet");
      }

      if (!ARTIST_STATUSES.has(statusValue)) {
        errors.push("status must be active, hidden, or archived");
      }

      const thumbnailUrl = normalizeText(valueAt(row, headerIndex, "thumbnail_url"));
      const characterUrl = normalizeText(valueAt(row, headerIndex, "character_url"));
      const galleryPostUrls = splitPipe(valueAt(row, headerIndex, "gallery_post_urls"));
      const sourceUpdatedAt = normalizeText(valueAt(row, headerIndex, "source_updated_at"));
      if (!isHttpUrl(thumbnailUrl)) errors.push("thumbnail_url must be an HTTP(S) URL");
      if (!isHttpUrl(characterUrl)) errors.push("character_url must be an HTTP(S) URL");
      if (galleryPostUrls.some((url) => !isInstagramPostUrl(url))) {
        errors.push("gallery_post_urls must contain Instagram post URLs");
      }
      if (sourceUpdatedAt && Number.isNaN(Date.parse(sourceUpdatedAt))) {
        errors.push("source_updated_at must be an ISO timestamp");
      }

      const record: ArtistSheetRecord = {
        artist_id: artistId,
        name,
        instagram_handle: instagramHandle,
        main_category_id: normalizeText(valueAt(row, headerIndex, "main_category_id")),
        main_category_name: normalizeText(valueAt(row, headerIndex, "main_category_name")),
        bio: normalizeText(valueAt(row, headerIndex, "bio")),
        hashtags: splitHashtags(valueAt(row, headerIndex, "hashtags")),
        search_tags: splitPipe(valueAt(row, headerIndex, "search_tags")),
        mood_tags: splitPipe(valueAt(row, headerIndex, "mood_tags")),
        style_tags: splitPipe(valueAt(row, headerIndex, "style_tags")),
        topic_tags: splitPipe(valueAt(row, headerIndex, "topic_tags")),
        thumbnail_url: thumbnailUrl,
        character_url: characterUrl,
        gallery_post_urls: galleryPostUrls,
        show_on_site: parseBoolean(valueAt(row, headerIndex, "show_on_site"), true, errors, "show_on_site"),
        show_growth_on_site: parseBoolean(
          valueAt(row, headerIndex, "show_growth_on_site"),
          true,
          errors,
          "show_growth_on_site"
        ),
        is_trending: parseBoolean(valueAt(row, headerIndex, "is_trending"), false, errors, "is_trending"),
        hide_from_new: parseBoolean(valueAt(row, headerIndex, "hide_from_new"), false, errors, "hide_from_new"),
        status: ARTIST_STATUSES.has(statusValue) ? (statusValue as ArtistSheetRecord["status"]) : "active",
        sort_order: parseNumber(valueAt(row, headerIndex, "sort_order"), errors, "sort_order"),
        internal_memo: normalizeText(valueAt(row, headerIndex, "internal_memo")),
        source_updated_at: sourceUpdatedAt
      };

      return {
        rowNumber,
        action: artistId ? "update" : "create",
        record,
        errors
      };
    })
    .filter((row) => row.action !== "skip" || row.errors.length > 0);
}

export function parseArtistStatsSheetValues(values: string[][]): ArtistStatsSheetPreviewRow[] {
  const [headers = [], ...rows] = values;
  const normalizedHeaders = headers.map((header) => normalizeText(String(header)));
  const headerIndex = new Map(normalizedHeaders.map((header, index) => [header, index]));
  const requiredHeaders = ["artist_id", "recorded_date", "followers", "post_count"];
  const missingHeaders = requiredHeaders.filter((header) => !headerIndex.has(header));
  const keyCounts = rows.reduce<Map<string, number>>((counts, row) => {
    if (isEmptyRow(row)) {
      return counts;
    }

    const artistId = normalizeText(valueAt(row, headerIndex, "artist_id"));
    const recordedDate = normalizeText(valueAt(row, headerIndex, "recorded_date"));
    if (!artistId || !recordedDate) {
      return counts;
    }

    const key = `${artistId}::${recordedDate}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return rows
    .map((row, index): ArtistStatsSheetPreviewRow => {
      const rowNumber = index + 2;
      if (isEmptyRow(row)) {
        return { rowNumber, action: "skip", record: null, errors: [] };
      }

      const errors = missingHeaders.map((header) => `missing header: ${header}`);
      const artistId = normalizeText(valueAt(row, headerIndex, "artist_id"));
      const recordedDate = normalizeText(valueAt(row, headerIndex, "recorded_date"));
      const followers = parseNonNegativeInteger(valueAt(row, headerIndex, "followers"), errors, "followers");
      const postCount = parseNonNegativeInteger(valueAt(row, headerIndex, "post_count"), errors, "post_count");
      if (!artistId) {
        errors.push("artist_id is required");
      }

      if (!recordedDate) {
        errors.push("recorded_date is required");
      } else if (!isIsoDate(recordedDate)) {
        errors.push("recorded_date must be YYYY-MM-DD");
      }

      if (followers === null) {
        errors.push("followers is required");
      }

      if (postCount === null) {
        errors.push("post_count is required");
      }

      if (artistId && recordedDate && (keyCounts.get(`${artistId}::${recordedDate}`) ?? 0) > 1) {
        errors.push("duplicate artist/date stat in sheet");
      }

      return {
        rowNumber,
        action: "upsert",
        record: {
          artist_id: artistId,
          recorded_date: recordedDate,
          followers,
          post_count: postCount
        },
        errors
      };
    })
    .filter((row) => row.action !== "skip" || row.errors.length > 0);
}

export function encodePipeList(values: string[] | null | undefined) {
  return Array.isArray(values) ? values.filter(Boolean).join("|") : "";
}
