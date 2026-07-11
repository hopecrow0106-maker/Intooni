import { normalizeTagList, normalizeText } from "@/lib/normalize";
import {
  ARTIST_B2B_PROFILES_SHEET_HEADERS,
  ARTIST_COLLABORATIONS_SHEET_HEADERS,
  ARTIST_CONTACTS_SHEET_HEADERS,
  BRAND_CATEGORIES_SHEET_HEADERS,
  CATEGORIES_SHEET_HEADERS
} from "@/lib/sheets/artist-sheet";

export type SheetImportStatus = "CREATE" | "UPDATE" | "NO_CHANGE" | "CONFLICT" | "ERROR";

export type SheetPreviewRow<T> = {
  rowNumber: number;
  status: SheetImportStatus;
  record: T | null;
  errors: string[];
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export type CategorySheetRecord = {
  category_id: string;
  name: string;
  sort_order: number;
  source_updated_at: string;
};

export type ArtistContactSheetRecord = {
  artist_id: string;
  email: string;
  dm_available: boolean | null;
  source_updated_at: string;
};

export type ArtistCollaborationSheetRecord = {
  collaboration_id: string;
  artist_id: string;
  brand_name: string;
  brand_category_id: string;
  brand_category_name: string;
  collaboration_year: number | null;
  collaboration_month: number | null;
  post_url: string;
  content_summary: string;
  ad_disclosure_status: "yes" | "no" | "unknown";
  likes: number | null;
  comments: number | null;
  views: number | null;
  source_updated_at: string;
};

export type ArtistB2bProfileSheetRecord = {
  artist_id: string;
  recommended_brand_categories: string[];
  strengths: string;
  cautions: string;
  brand_safety_grade: "unknown" | "safe" | "normal" | "caution";
  source_updated_at: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BROKEN_TEXT_PATTERN = /\uFFFD|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function valueAt(row: string[], indexes: Map<string, number>, key: string) {
  const index = indexes.get(key);
  return index === undefined ? "" : normalizeText(String(row[index] ?? ""));
}

function isEmptyRow(row: string[]) {
  return row.every((value) => !String(value ?? "").trim());
}

function rowContext(values: string[][], expectedHeaders: readonly string[]) {
  const [rawHeaders = [], ...rows] = values;
  const headers = rawHeaders.map((header) => normalizeText(String(header)));
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const missingHeaders = expectedHeaders.filter((header) => !indexes.has(header));
  return { rows, indexes, missingHeaders };
}

function baseErrors(missingHeaders: readonly string[], values: string[]) {
  const errors = missingHeaders.map((header) => `missing header: ${header}`);
  if (values.some((value) => BROKEN_TEXT_PATTERN.test(value))) {
    errors.push("row contains broken encoding characters");
  }
  return errors;
}

function validateUuid(value: string, label: string, errors: string[], required = true) {
  if (!value) {
    if (required) {
      errors.push(`${label} is required`);
    }
    return;
  }
  if (!UUID_PATTERN.test(value)) {
    errors.push(`${label} must be a UUID`);
  }
}

function parseInteger(
  value: string,
  label: string,
  errors: string[],
  { required = false, min, max }: { required?: boolean; min?: number; max?: number } = {}
) {
  if (!value) {
    if (required) {
      errors.push(`${label} is required`);
    }
    return null;
  }
  const number = Number(value.replace(/,/g, ""));
  if (!Number.isInteger(number)) {
    errors.push(`${label} must be an integer`);
    return null;
  }
  if (min !== undefined && number < min) {
    errors.push(`${label} must be at least ${min}`);
  }
  if (max !== undefined && number > max) {
    errors.push(`${label} must be at most ${max}`);
  }
  return number;
}

function parseNullableBoolean(value: string, label: string, errors: string[]) {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "y", "예", "네"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "아니오"].includes(normalized)) {
    return false;
  }
  errors.push(`${label} must be true, false, or blank`);
  return null;
}

function parsePipeList(value: string) {
  return normalizeTagList(value.split("|").filter(Boolean));
}

function isInstagramPostUrl(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)instagram\.com$/i.test(url.hostname) && /^\/(p|reel|tv)\//.test(url.pathname);
  } catch {
    return false;
  }
}

export function parseCategorySheetValues(
  values: string[][],
  target: "categories" | "brand_categories"
): SheetPreviewRow<CategorySheetRecord>[] {
  const headers = target === "categories" ? CATEGORIES_SHEET_HEADERS : BRAND_CATEGORIES_SHEET_HEADERS;
  const idHeader = target === "categories" ? "category_id" : "brand_category_id";
  const { rows, indexes, missingHeaders } = rowContext(values, headers);
  const names = new Map<string, number>();

  for (const row of rows) {
    const name = valueAt(row, indexes, "name");
    if (name) names.set(name, (names.get(name) ?? 0) + 1);
  }

  return rows.flatMap((row, index) => {
    if (isEmptyRow(row)) return [];
    const errors = baseErrors(missingHeaders, row);
    const categoryId = valueAt(row, indexes, idHeader);
    const name = valueAt(row, indexes, "name");
    validateUuid(categoryId, idHeader, errors, false);
    if (!name) errors.push("name is required");
    if ((names.get(name) ?? 0) > 1) errors.push("duplicate normalized name in sheet");
    const sortOrder = parseInteger(valueAt(row, indexes, "sort_order"), "sort_order", errors) ?? 0;
    const record = {
      category_id: categoryId,
      name,
      sort_order: sortOrder,
      source_updated_at: valueAt(row, indexes, "updated_at")
    };
    return [{ rowNumber: index + 2, status: errors.length ? "ERROR" : "CREATE", record, errors }];
  });
}

export function parseArtistContactSheetValues(
  values: string[][]
): SheetPreviewRow<ArtistContactSheetRecord>[] {
  const { rows, indexes, missingHeaders } = rowContext(values, ARTIST_CONTACTS_SHEET_HEADERS);
  const artistCounts = new Map<string, number>();
  for (const row of rows) {
    const artistId = valueAt(row, indexes, "artist_id");
    if (artistId) artistCounts.set(artistId, (artistCounts.get(artistId) ?? 0) + 1);
  }
  return rows.flatMap((row, index) => {
    if (isEmptyRow(row)) return [];
    const errors = baseErrors(missingHeaders, row);
    const artistId = valueAt(row, indexes, "artist_id");
    const email = valueAt(row, indexes, "email");
    validateUuid(artistId, "artist_id", errors);
    if ((artistCounts.get(artistId) ?? 0) > 1) errors.push("duplicate artist_id in sheet");
    if (email && !EMAIL_PATTERN.test(email)) errors.push("email is invalid");
    const record = {
      artist_id: artistId,
      email,
      dm_available: parseNullableBoolean(valueAt(row, indexes, "dm_available"), "dm_available", errors),
      source_updated_at: valueAt(row, indexes, "source_updated_at")
    };
    return [{ rowNumber: index + 2, status: errors.length ? "ERROR" : "CREATE", record, errors }];
  });
}

export function parseArtistCollaborationSheetValues(
  values: string[][]
): SheetPreviewRow<ArtistCollaborationSheetRecord>[] {
  const { rows, indexes, missingHeaders } = rowContext(values, ARTIST_COLLABORATIONS_SHEET_HEADERS);
  const keys = new Map<string, number>();
  for (const row of rows) {
    const key = `${valueAt(row, indexes, "artist_id")}::${valueAt(row, indexes, "post_url")}`;
    if (key !== "::") keys.set(key, (keys.get(key) ?? 0) + 1);
  }

  return rows.flatMap((row, index) => {
    if (isEmptyRow(row)) return [];
    const errors = baseErrors(missingHeaders, row);
    const collaborationId = valueAt(row, indexes, "collaboration_id");
    const artistId = valueAt(row, indexes, "artist_id");
    const brandName = valueAt(row, indexes, "brand_name");
    const brandCategoryId = valueAt(row, indexes, "brand_category_id");
    const postUrl = valueAt(row, indexes, "post_url");
    validateUuid(collaborationId, "collaboration_id", errors, false);
    validateUuid(artistId, "artist_id", errors);
    validateUuid(brandCategoryId, "brand_category_id", errors, false);
    if (!brandName) errors.push("brand_name is required");
    if (!postUrl) errors.push("post_url is required");
    else if (!isInstagramPostUrl(postUrl)) errors.push("post_url must be an Instagram post URL");
    if ((keys.get(`${artistId}::${postUrl}`) ?? 0) > 1) errors.push("duplicate artist/post_url in sheet");
    const disclosure = valueAt(row, indexes, "ad_disclosure_status") || "unknown";
    if (!["yes", "no", "unknown"].includes(disclosure)) {
      errors.push("ad_disclosure_status must be yes, no, or unknown");
    }
    const record: ArtistCollaborationSheetRecord = {
      collaboration_id: collaborationId,
      artist_id: artistId,
      brand_name: brandName,
      brand_category_id: brandCategoryId,
      brand_category_name: valueAt(row, indexes, "brand_category_name"),
      collaboration_year: parseInteger(
        valueAt(row, indexes, "collaboration_year"),
        "collaboration_year",
        errors,
        { required: true, min: 2000 }
      ),
      collaboration_month: parseInteger(
        valueAt(row, indexes, "collaboration_month"),
        "collaboration_month",
        errors,
        { min: 1, max: 12 }
      ),
      post_url: postUrl,
      content_summary: valueAt(row, indexes, "content_summary"),
      ad_disclosure_status: ["yes", "no", "unknown"].includes(disclosure)
        ? (disclosure as ArtistCollaborationSheetRecord["ad_disclosure_status"])
        : "unknown",
      likes: parseInteger(valueAt(row, indexes, "likes"), "likes", errors, { min: 0 }),
      comments: parseInteger(valueAt(row, indexes, "comments"), "comments", errors, { min: 0 }),
      views: parseInteger(valueAt(row, indexes, "views"), "views", errors, { min: 0 }),
      source_updated_at: valueAt(row, indexes, "source_updated_at")
    };
    return [{ rowNumber: index + 2, status: errors.length ? "ERROR" : "CREATE", record, errors }];
  });
}

export function parseArtistB2bProfileSheetValues(
  values: string[][]
): SheetPreviewRow<ArtistB2bProfileSheetRecord>[] {
  const { rows, indexes, missingHeaders } = rowContext(values, ARTIST_B2B_PROFILES_SHEET_HEADERS);
  const artistCounts = new Map<string, number>();
  for (const row of rows) {
    const artistId = valueAt(row, indexes, "artist_id");
    if (artistId) artistCounts.set(artistId, (artistCounts.get(artistId) ?? 0) + 1);
  }
  return rows.flatMap((row, index) => {
    if (isEmptyRow(row)) return [];
    const errors = baseErrors(missingHeaders, row);
    const artistId = valueAt(row, indexes, "artist_id");
    validateUuid(artistId, "artist_id", errors);
    if ((artistCounts.get(artistId) ?? 0) > 1) errors.push("duplicate artist_id in sheet");
    const grade = valueAt(row, indexes, "brand_safety_grade") || "unknown";
    if (!["unknown", "safe", "normal", "caution"].includes(grade)) {
      errors.push("brand_safety_grade must be unknown, safe, normal, or caution");
    }
    const record: ArtistB2bProfileSheetRecord = {
      artist_id: artistId,
      recommended_brand_categories: parsePipeList(valueAt(row, indexes, "recommended_brand_categories")),
      strengths: valueAt(row, indexes, "strengths"),
      cautions: valueAt(row, indexes, "cautions"),
      brand_safety_grade: ["unknown", "safe", "normal", "caution"].includes(grade)
        ? (grade as ArtistB2bProfileSheetRecord["brand_safety_grade"])
        : "unknown",
      source_updated_at: valueAt(row, indexes, "source_updated_at")
    };
    return [{ rowNumber: index + 2, status: errors.length ? "ERROR" : "CREATE", record, errors }];
  });
}
