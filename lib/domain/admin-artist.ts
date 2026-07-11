import { normalizeInstagramHandle, normalizeTagList, normalizeText } from "@/lib/normalize";

export type ArtistStatus = "active" | "hidden" | "archived";

export type AdminArtistPayload = {
  id?: string;
  name?: string;
  instagram_handle?: string;
  main_category_id?: string | null;
  bio?: string;
  hashtags?: string[];
  search_tags?: string[];
  mood_tags?: string[];
  style_tags?: string[];
  topic_tags?: string[];
  thumbnail_url?: string;
  character_url?: string;
  gallery_post_urls?: string[];
  show_on_site?: boolean;
  show_growth_on_site?: boolean;
  is_trending?: boolean;
  hide_from_new?: boolean;
  status?: ArtistStatus;
  sort_order?: number;
  internal_memo?: string;
};

function optionalText(value: unknown) {
  return normalizeText(typeof value === "string" ? value : "");
}

function optionalTags(value: unknown) {
  return normalizeTagList(Array.isArray(value) ? value.map(String) : []);
}

function optionalBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function validateUrl(value: string, label: string, instagramPost = false) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    if (
      instagramPost &&
      (!/(^|\.)instagram\.com$/i.test(url.hostname) || !/^\/(p|reel|tv)\//.test(url.pathname))
    ) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error(`${label} URL 형식이 올바르지 않습니다.`);
  }
}

export function sanitizeArtistPayload(input: unknown, partial = false): AdminArtistPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("작가 payload 형식이 올바르지 않습니다.");
  }
  const raw = input as Record<string, unknown>;
  const payload: AdminArtistPayload = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key);

  if (has("id")) payload.id = optionalText(raw.id);
  if (!partial || has("name")) payload.name = optionalText(raw.name);
  if (!partial || has("instagram_handle")) {
    payload.instagram_handle = normalizeInstagramHandle(optionalText(raw.instagram_handle));
  }
  if (!partial || has("main_category_id")) {
    payload.main_category_id = optionalText(raw.main_category_id) || null;
  }
  if (!partial || has("bio")) payload.bio = optionalText(raw.bio);
  if (!partial || has("hashtags")) payload.hashtags = optionalTags(raw.hashtags);
  if (!partial || has("search_tags")) payload.search_tags = optionalTags(raw.search_tags);
  if (!partial || has("mood_tags")) payload.mood_tags = optionalTags(raw.mood_tags);
  if (!partial || has("style_tags")) payload.style_tags = optionalTags(raw.style_tags);
  if (!partial || has("topic_tags")) payload.topic_tags = optionalTags(raw.topic_tags);
  if (!partial || has("thumbnail_url")) {
    payload.thumbnail_url = validateUrl(optionalText(raw.thumbnail_url), "thumbnail_url");
  }
  if (!partial || has("character_url")) {
    payload.character_url = validateUrl(optionalText(raw.character_url), "character_url");
  }
  if (!partial || has("gallery_post_urls")) {
    payload.gallery_post_urls = Array.isArray(raw.gallery_post_urls)
      ? raw.gallery_post_urls
          .map((value) => validateUrl(optionalText(value), "gallery_post_urls", true))
          .filter(Boolean)
      : [];
  }
  if (!partial || has("show_on_site")) {
    payload.show_on_site = optionalBoolean(raw.show_on_site, true);
  }
  if (!partial || has("show_growth_on_site")) {
    payload.show_growth_on_site = optionalBoolean(raw.show_growth_on_site, true);
  }
  if (!partial || has("is_trending")) {
    payload.is_trending = optionalBoolean(raw.is_trending, false);
  }
  if (!partial || has("hide_from_new")) {
    payload.hide_from_new = optionalBoolean(raw.hide_from_new, false);
  }
  if (!partial || has("status")) {
    const status = optionalText(raw.status) || "active";
    if (!["active", "hidden", "archived"].includes(status)) {
      throw new Error("status는 active, hidden, archived 중 하나여야 합니다.");
    }
    payload.status = status as ArtistStatus;
  }
  if (has("sort_order")) {
    const sortOrder = Number(raw.sort_order);
    if (!Number.isInteger(sortOrder)) throw new Error("sort_order는 정수여야 합니다.");
    payload.sort_order = sortOrder;
  }
  if (!partial || has("internal_memo")) {
    payload.internal_memo = optionalText(raw.internal_memo);
  }

  if (!partial && (!payload.name || !payload.instagram_handle || !payload.main_category_id)) {
    throw new Error("작가명, 인스타 계정, 카테고리는 필수입니다.");
  }
  return payload;
}
