import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  parseArtistB2bProfileSheetValues,
  parseArtistCollaborationSheetValues,
  parseArtistContactSheetValues,
  parseCategorySheetValues,
  type ArtistB2bProfileSheetRecord,
  type ArtistCollaborationSheetRecord,
  type ArtistContactSheetRecord,
  type CategorySheetRecord,
  type SheetPreviewRow
} from "@/lib/sheets/admin-data-sheets";
import {
  ARTIST_B2B_PROFILES_SHEET_HEADERS,
  ARTIST_COLLABORATIONS_SHEET_HEADERS,
  ARTIST_CONTACTS_SHEET_HEADERS,
  ARTIST_STATS_SHEET_HEADERS,
  ARTISTS_SHEET_HEADERS,
  BRAND_CATEGORIES_SHEET_HEADERS,
  CATEGORIES_SHEET_HEADERS,
  encodePipeList,
  parseArtistSheetValues,
  parseArtistStatsSheetValues,
  type ArtistSheetRecord,
  type ArtistStatsSheetRecord
} from "@/lib/sheets/artist-sheet";
import {
  clearSheetRange,
  ensureSheetTabs,
  ensureGoogleSheetsEnabled,
  getGoogleSheetsSpreadsheetId,
  getSheetValues,
  updateSheetValues
} from "@/lib/server/google-sheets";

type SheetJobStatus = "preview" | "applied" | "failed" | "cancelled";
export type AdminSheetImportTarget =
  | "categories"
  | "brand_categories"
  | "artists"
  | "artist_stats"
  | "artist_contacts"
  | "artist_collaborations"
  | "artist_b2b_profiles";
const ADMIN_SHEET_IMPORT_TARGETS = new Set<AdminSheetImportTarget>([
  "categories",
  "brand_categories",
  "artists",
  "artist_stats",
  "artist_contacts",
  "artist_collaborations",
  "artist_b2b_profiles"
]);

export function isAdminSheetImportTarget(value: string): value is AdminSheetImportTarget {
  return ADMIN_SHEET_IMPORT_TARGETS.has(value as AdminSheetImportTarget);
}
type ArtistImportStatus = "CREATE" | "UPDATE" | "NO_CHANGE" | "CONFLICT" | "ERROR";

function toCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return encodePipeList(value.filter((item): item is string => typeof item === "string"));
  }

  return value;
}

function comparableValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return Array.isArray(value) ? value : value;
}

function artistComparableRecord(record: ArtistSheetRecord, mainCategoryId: string | null) {
  return {
    name: record.name,
    instagram_handle: record.instagram_handle,
    main_category_id: mainCategoryId ?? "",
    bio: record.bio,
    hashtags: record.hashtags,
    search_tags: record.search_tags,
    mood_tags: record.mood_tags,
    style_tags: record.style_tags,
    topic_tags: record.topic_tags,
    thumbnail_url: record.thumbnail_url,
    character_url: record.character_url,
    gallery_post_urls: record.gallery_post_urls,
    show_on_site: record.show_on_site,
    show_growth_on_site: record.show_growth_on_site,
    is_trending: record.is_trending,
    hide_from_new: record.hide_from_new,
    status: record.status,
    sort_order: record.sort_order ?? 0,
    internal_memo: record.internal_memo
  };
}

function artistDatabaseComparable(row: any) {
  return {
    name: comparableValue(row.name),
    instagram_handle: comparableValue(row.instagram_handle),
    main_category_id: comparableValue(row.main_category_id),
    bio: comparableValue(row.bio),
    hashtags: comparableValue(row.hashtags),
    search_tags: comparableValue(row.search_tags),
    mood_tags: comparableValue(row.mood_tags),
    style_tags: comparableValue(row.style_tags),
    topic_tags: comparableValue(row.topic_tags),
    thumbnail_url: comparableValue(row.thumbnail_url),
    character_url: comparableValue(row.character_url),
    gallery_post_urls: comparableValue(row.gallery_post_urls),
    show_on_site: row.show_on_site,
    show_growth_on_site: row.show_growth_on_site,
    is_trending: row.is_trending,
    hide_from_new: row.hide_from_new,
    status: row.status,
    sort_order: row.sort_order ?? 0,
    internal_memo: comparableValue(row.internal_memo)
  };
}

function sameComparableRecord(left: Record<string, unknown>, right: Record<string, unknown>) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function recordSheetJob({
  jobType,
  status,
  sheetName,
  summary,
  errorMessage
}: {
  jobType: string;
  status: SheetJobStatus;
  sheetName?: string;
  summary: Record<string, unknown>;
  errorMessage?: string;
}) {
  try {
    const supabase = getSupabaseAdminClient() as any;
    let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "";
    try {
      spreadsheetId = getGoogleSheetsSpreadsheetId();
    } catch {
      // Job logging should not fail older/preconfigured environments.
    }

    await supabase.from("sheet_sync_jobs").insert({
      job_type: jobType,
      status,
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName ?? null,
      summary,
      error_message: errorMessage ?? null,
      finished_at: new Date().toISOString()
    });
  } catch {
    // The table exists after the additive migration. Before then, jobs are best-effort only.
  }
}

async function readArtistsForExport() {
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("artists")
    .select(
      "id, name, instagram_handle, main_category_id, bio, hashtags, search_tags, mood_tags, style_tags, topic_tags, thumbnail_url, character_url, gallery_post_urls, show_on_site, show_growth_on_site, is_trending, hide_from_new, status, sort_order, internal_memo, created_at, updated_at, main_category:categories!artists_main_category_id_fkey(id, name)"
    )
    .order("sort_order", { ascending: true });

  if (!error) {
    return data ?? [];
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from("artists")
    .select(
      "id, name, instagram_handle, genre, bio, hashtags, hidden_tags, mood_tags, style_tags, topic_tags, thumbnail_url, character_url, gallery_post_urls, is_hot, hide_from_new, sort_order, memo, created_at"
    )
    .order("sort_order", { ascending: true });

  if (legacyError) {
    throw error;
  }

  return legacyData ?? [];
}

async function readCategoriesForExport() {
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function readStatsForExport() {
  try {
    const supabase = getSupabaseAdminClient() as any;
    const rows: any[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("artist_stats")
        .select("artist_id, recorded_date, followers, post_count")
        .order("recorded_date", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) return [];
      rows.push(...(data ?? []));
      if ((data ?? []).length < pageSize) break;
    }

    return rows;
  } catch {
    return [];
  }
}

async function readBrandCategoriesForExport() {
  try {
    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("brand_categories")
      .select("id, name, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true });

    if (error) {
      return [];
    }

    return data ?? [];
  } catch {
    return [];
  }
}

async function readArtistContactsForExport() {
  try {
    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("artist_contacts")
      .select("artist_id, email, dm_available, updated_at")
      .order("artist_id", { ascending: true });

    if (error) {
      return [];
    }

    return data ?? [];
  } catch {
    return [];
  }
}

async function readArtistB2bProfilesForExport() {
  try {
    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("artist_b2b_profiles")
      .select(
        "artist_id, strengths, cautions, brand_safety_grade, updated_at, artist_recommended_brand_categories(brand_categories(name))"
      )
      .order("artist_id", { ascending: true });

    if (error) {
      return [];
    }

    return data ?? [];
  } catch {
    return [];
  }
}

async function readArtistCollaborationsForExport() {
  try {
    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("artist_collaborations")
      .select(
        "id, artist_id, brand_name, brand_category_id, collaboration_year, collaboration_month, post_url, content_summary, ad_disclosure_status, likes, comments, views, updated_at, brand_categories(name)"
      )
      .order("collaboration_year", { ascending: false });

    if (error) {
      return [];
    }

    return data ?? [];
  } catch {
    return [];
  }
}

function artistExportRow(row: any) {
  return [
    row.id,
    row.name,
    row.instagram_handle,
    row.main_category_id ?? row.main_category?.id ?? "",
    row.main_category_name ?? row.main_category?.name ?? row.genre ?? "",
    row.bio,
    toCellValue(row.hashtags),
    toCellValue(row.search_tags ?? row.hidden_tags),
    toCellValue(row.mood_tags),
    toCellValue(row.style_tags),
    toCellValue(row.topic_tags),
    row.thumbnail_url,
    row.character_url,
    toCellValue(row.gallery_post_urls),
    row.show_on_site ?? true,
    row.show_growth_on_site ?? true,
    row.is_trending ?? row.is_hot ?? false,
    row.hide_from_new ?? false,
    row.status ?? "active",
    row.sort_order,
    row.internal_memo ?? row.memo ?? "",
    row.updated_at ?? ""
  ].map(toCellValue);
}

function brandCategoryExportRow(row: any) {
  return [row.id, row.name, row.sort_order, row.updated_at].map(toCellValue);
}

function artistStatsExportRow(row: any) {
  return [row.artist_id, row.recorded_date, row.followers, row.post_count].map(toCellValue);
}

function artistContactExportRow(row: any) {
  return [row.artist_id, row.email, row.dm_available, row.updated_at].map(toCellValue);
}

function artistB2bProfileExportRow(row: any) {
  const recommendedCategories = (row.artist_recommended_brand_categories ?? [])
    .map((item: any) => item.brand_categories?.name)
    .filter(Boolean);

  return [
    row.artist_id,
    toCellValue(recommendedCategories),
    toCellValue(row.strengths),
    toCellValue(row.cautions),
    row.brand_safety_grade,
    row.updated_at
  ].map(toCellValue);
}

function artistCollaborationExportRow(row: any) {
  return [
    row.id,
    row.artist_id,
    row.brand_name,
    row.brand_category_id,
    row.brand_categories?.name ?? "",
    row.collaboration_year,
    row.collaboration_month,
    row.post_url,
    row.content_summary,
    row.ad_disclosure_status,
    row.likes,
    row.comments,
    row.views,
    row.updated_at
  ].map(toCellValue);
}

function buildMetricHistoryValues({
  artists,
  stats,
  metric
}: {
  artists: any[];
  stats: any[];
  metric: "followers" | "post_count";
}) {
  const dates = Array.from(
    new Set(stats.map((row) => String(row.recorded_date ?? "")).filter(Boolean))
  ).sort();
  const valuesByArtist = new Map<string, Map<string, number>>();

  for (const stat of stats) {
    const artistValues = valuesByArtist.get(stat.artist_id) ?? new Map<string, number>();
    artistValues.set(String(stat.recorded_date), Number(stat[metric] ?? 0));
    valuesByArtist.set(stat.artist_id, artistValues);
  }

  return [
    ["artist_id", "name", "instagram_handle", ...dates],
    ...artists.map((artist) => {
      const artistValues = valuesByArtist.get(artist.id);
      return [
        artist.id,
        artist.name,
        artist.instagram_handle,
        ...dates.map((date) => artistValues?.get(date) ?? "")
      ];
    })
  ];
}

export async function exportAdminSheets() {
  ensureGoogleSheetsEnabled();
  const spreadsheetId = getGoogleSheetsSpreadsheetId();
  const [categories, brandCategories, artists, stats, contacts, collaborations, b2bProfiles] = await Promise.all([
    readCategoriesForExport(),
    readBrandCategoriesForExport(),
    readArtistsForExport(),
    readStatsForExport(),
    readArtistContactsForExport(),
    readArtistCollaborationsForExport(),
    readArtistB2bProfilesForExport()
  ]);

  const categoriesValues = [
    [...CATEGORIES_SHEET_HEADERS],
    ...categories.map((category: any) => [
      category.id,
      category.name,
      category.sort_order,
      (category as any).updated_at ?? ""
    ])
  ];
  const brandCategoriesValues = [
    [...BRAND_CATEGORIES_SHEET_HEADERS],
    ...brandCategories.map(brandCategoryExportRow)
  ];
  const artistsValues = [[...ARTISTS_SHEET_HEADERS], ...artists.map(artistExportRow)];
  const statsValues = [[...ARTIST_STATS_SHEET_HEADERS], ...stats.map(artistStatsExportRow)];
  const followersHistoryValues = buildMetricHistoryValues({ artists, stats, metric: "followers" });
  const postsHistoryValues = buildMetricHistoryValues({ artists, stats, metric: "post_count" });
  const contactsValues = [[...ARTIST_CONTACTS_SHEET_HEADERS], ...contacts.map(artistContactExportRow)];
  const collaborationsValues = [
    [...ARTIST_COLLABORATIONS_SHEET_HEADERS],
    ...collaborations.map(artistCollaborationExportRow)
  ];
  const b2bProfilesValues = [
    [...ARTIST_B2B_PROFILES_SHEET_HEADERS],
    ...b2bProfiles.map(artistB2bProfileExportRow)
  ];

  await ensureSheetTabs(spreadsheetId, ["followers_history", "posts_history"]);
  await Promise.all([
    clearSheetRange(spreadsheetId, "categories!A1:D10000"),
    clearSheetRange(spreadsheetId, "brand_categories!A1:D10000"),
    clearSheetRange(spreadsheetId, "artists!A1:V10000"),
    clearSheetRange(spreadsheetId, "artist_stats!A1:D10000"),
    clearSheetRange(spreadsheetId, "followers_history!A1:ZZZ10000"),
    clearSheetRange(spreadsheetId, "posts_history!A1:ZZZ10000"),
    clearSheetRange(spreadsheetId, "artist_contacts!A1:D10000"),
    clearSheetRange(spreadsheetId, "artist_collaborations!A1:N10000"),
    clearSheetRange(spreadsheetId, "artist_b2b_profiles!A1:F10000")
  ]);
  await Promise.all([
    updateSheetValues(spreadsheetId, "categories!A1", categoriesValues),
    updateSheetValues(spreadsheetId, "brand_categories!A1", brandCategoriesValues),
    updateSheetValues(spreadsheetId, "artists!A1", artistsValues),
    updateSheetValues(spreadsheetId, "artist_stats!A1", statsValues),
    updateSheetValues(spreadsheetId, "followers_history!A1", followersHistoryValues),
    updateSheetValues(spreadsheetId, "posts_history!A1", postsHistoryValues),
    updateSheetValues(spreadsheetId, "artist_contacts!A1", contactsValues),
    updateSheetValues(spreadsheetId, "artist_collaborations!A1", collaborationsValues),
    updateSheetValues(spreadsheetId, "artist_b2b_profiles!A1", b2bProfilesValues)
  ]);

  const summary = {
    categories: categories.length,
    brand_categories: brandCategories.length,
    artists: artists.length,
    followers_history_artists: Math.max(followersHistoryValues.length - 1, 0),
    posts_history_artists: Math.max(postsHistoryValues.length - 1, 0),
    history_dates: Math.max(followersHistoryValues[0].length - 3, 0),
    artist_contacts: contacts.length,
    artist_collaborations: collaborations.length,
    artist_b2b_profiles: b2bProfiles.length
  };
  await recordSheetJob({ jobType: "export", status: "applied", summary });
  return summary;
}

export async function previewArtistSheetImport() {
  ensureGoogleSheetsEnabled();
  const spreadsheetId = getGoogleSheetsSpreadsheetId();
  const values = await getSheetValues(spreadsheetId, "artists!A1:V10000");
  const parsedRows = parseArtistSheetValues(values);
  const supabase = getSupabaseAdminClient() as any;
  const rows = [];

  for (const row of parsedRows) {
    if (!row.record || row.errors.length > 0) {
      rows.push({ ...row, status: "ERROR" as ArtistImportStatus, before: null, after: row.record });
      continue;
    }

    const record = row.record;
    const categoryQuery = record.main_category_id
      ? supabase.from("categories").select("id, name").eq("id", record.main_category_id).maybeSingle()
      : record.main_category_name
        ? supabase.from("categories").select("id, name").eq("name", record.main_category_name).maybeSingle()
        : Promise.resolve({ data: null, error: null });
    const { data: category, error: categoryError } = await categoryQuery;

    if (categoryError || ((record.main_category_id || record.main_category_name) && !category)) {
      rows.push({
        ...row,
        status: "ERROR" as ArtistImportStatus,
        before: null,
        after: record,
        errors: [...row.errors, "main category does not exist"]
      });
      continue;
    }

    if (
      category &&
      record.main_category_id &&
      record.main_category_name &&
      category.name !== record.main_category_name
    ) {
      rows.push({
        ...row,
        status: "ERROR" as ArtistImportStatus,
        before: null,
        after: record,
        errors: [...row.errors, "main_category_id and main_category_name do not match"]
      });
      continue;
    }

    const artistSelect =
      "id, name, instagram_handle, main_category_id, bio, hashtags, search_tags, mood_tags, style_tags, topic_tags, thumbnail_url, character_url, gallery_post_urls, show_on_site, show_growth_on_site, is_trending, hide_from_new, status, sort_order, internal_memo, updated_at";
    const lookupColumn = record.artist_id ? "id" : "instagram_handle";
    const lookupValue = record.artist_id || record.instagram_handle;
    const { data: existing, error: existingError } = await supabase
      .from("artists")
      .select(artistSelect)
      .eq(lookupColumn, lookupValue)
      .maybeSingle();

    if (existingError) {
      rows.push({
        ...row,
        status: "ERROR" as ArtistImportStatus,
        before: null,
        after: record,
        errors: [...row.errors, existingError.message ?? "artist lookup failed"]
      });
      continue;
    }

    if (!record.artist_id && existing) {
      rows.push({
        ...row,
        status: "ERROR" as ArtistImportStatus,
        before: existing,
        after: record,
        errors: [...row.errors, "instagram_handle already exists; use its artist_id"]
      });
      continue;
    }

    if (record.artist_id && !existing) {
      rows.push({
        ...row,
        status: "ERROR" as ArtistImportStatus,
        before: null,
        after: record,
        errors: [...row.errors, "artist_id does not exist"]
      });
      continue;
    }

    const after = artistComparableRecord(record, category?.id ?? null);
    if (!existing) {
      rows.push({ ...row, status: "CREATE" as ArtistImportStatus, before: null, after });
      continue;
    }

    if (existing.instagram_handle !== record.instagram_handle) {
      const { data: duplicateHandle } = await supabase
        .from("artists")
        .select("id")
        .eq("instagram_handle", record.instagram_handle)
        .maybeSingle();
      if (duplicateHandle && duplicateHandle.id !== existing.id) {
        rows.push({
          ...row,
          status: "ERROR" as ArtistImportStatus,
          before: existing,
          after,
          errors: [...row.errors, "instagram_handle belongs to another artist"]
        });
        continue;
      }
    }

    const sourceUpdatedAt = Date.parse(record.source_updated_at);
    const databaseUpdatedAt = Date.parse(existing.updated_at ?? "");
    if (!Number.isFinite(sourceUpdatedAt) || !Number.isFinite(databaseUpdatedAt)) {
      rows.push({
        ...row,
        status: "CONFLICT" as ArtistImportStatus,
        before: existing,
        after,
        errors: [...row.errors, "valid source_updated_at is required for existing artists"]
      });
      continue;
    }

    if (databaseUpdatedAt > sourceUpdatedAt) {
      rows.push({
        ...row,
        status: "CONFLICT" as ArtistImportStatus,
        before: existing,
        after,
        errors: [...row.errors, "artist changed in DB after the sheet export"]
      });
      continue;
    }

    const before = artistDatabaseComparable(existing);
    rows.push({
      ...row,
      status: sameComparableRecord(before, after) ? "NO_CHANGE" : "UPDATE",
      before,
      after
    });
  }
  const summary = {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.status !== "ERROR" && row.status !== "CONFLICT").length,
    errorRows: rows.filter((row) => row.status === "ERROR").length,
    conflictRows: rows.filter((row) => row.status === "CONFLICT").length,
    createRows: rows.filter((row) => row.status === "CREATE").length,
    updateRows: rows.filter((row) => row.status === "UPDATE").length,
    noChangeRows: rows.filter((row) => row.status === "NO_CHANGE").length
  };
  await recordSheetJob({ jobType: "import_preview", status: "preview", sheetName: "artists", summary });
  return { rows, summary };
}

export async function previewArtistStatsSheetImport() {
  ensureGoogleSheetsEnabled();
  const spreadsheetId = getGoogleSheetsSpreadsheetId();
  const values = await getSheetValues(spreadsheetId, "artist_stats!A1:D10000");
  const rows = parseArtistStatsSheetValues(values);
  const summary = {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.errors.length === 0).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    upsertRows: rows.filter((row) => row.action === "upsert").length
  };
  await recordSheetJob({ jobType: "import_preview", status: "preview", sheetName: "artist_stats", summary });
  return { rows, summary };
}

function classifyExistingSheetRow<T extends { source_updated_at: string }>(
  row: SheetPreviewRow<T>,
  existing: any,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): SheetPreviewRow<T> {
  if (!existing) {
    return { ...row, status: "CREATE", before: null, after };
  }

  const sourceTime = Date.parse(row.record?.source_updated_at ?? "");
  const databaseTime = Date.parse(existing.updated_at ?? "");
  if (!Number.isFinite(sourceTime) || !Number.isFinite(databaseTime)) {
    return {
      ...row,
      status: "CONFLICT",
      before,
      after,
      errors: [...row.errors, "valid source_updated_at is required for existing rows"]
    };
  }

  if (databaseTime > sourceTime) {
    return {
      ...row,
      status: "CONFLICT",
      before,
      after,
      errors: [...row.errors, "row changed in DB after the sheet export"]
    };
  }

  return {
    ...row,
    status: sameComparableRecord(before ?? {}, after) ? "NO_CHANGE" : "UPDATE",
    before,
    after
  };
}

function generalSummary<T>(rows: SheetPreviewRow<T>[]) {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.status !== "ERROR" && row.status !== "CONFLICT").length,
    errorRows: rows.filter((row) => row.status === "ERROR").length,
    conflictRows: rows.filter((row) => row.status === "CONFLICT").length,
    createRows: rows.filter((row) => row.status === "CREATE").length,
    updateRows: rows.filter((row) => row.status === "UPDATE").length,
    noChangeRows: rows.filter((row) => row.status === "NO_CHANGE").length
  };
}

async function artistExists(artistId: string) {
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase.from("artists").select("id").eq("id", artistId).maybeSingle();
  return !error && Boolean(data?.id);
}

async function resolveBrandCategory(record: {
  brand_category_id: string;
  brand_category_name: string;
}) {
  if (!record.brand_category_id && !record.brand_category_name) {
    return { id: null, name: null, error: null };
  }

  const supabase = getSupabaseAdminClient() as any;
  const lookupColumn = record.brand_category_id ? "id" : "name";
  const lookupValue = record.brand_category_id || record.brand_category_name;
  const { data, error } = await supabase
    .from("brand_categories")
    .select("id, name")
    .eq(lookupColumn, lookupValue)
    .maybeSingle();

  if (error || !data) {
    return { id: null, name: null, error: "brand category does not exist" };
  }
  if (
    record.brand_category_id &&
    record.brand_category_name &&
    data.name !== record.brand_category_name
  ) {
    return { id: null, name: null, error: "brand_category_id and brand_category_name do not match" };
  }
  return { id: data.id as string, name: data.name as string, error: null };
}

async function previewCategoryImport(target: "categories" | "brand_categories") {
  ensureGoogleSheetsEnabled();
  const spreadsheetId = getGoogleSheetsSpreadsheetId();
  const values = await getSheetValues(spreadsheetId, `${target}!A1:D10000`);
  const parsedRows = parseCategorySheetValues(values, target);
  const rows: SheetPreviewRow<CategorySheetRecord>[] = [];
  const supabase = getSupabaseAdminClient() as any;

  for (const row of parsedRows) {
    if (!row.record || row.errors.length > 0) {
      rows.push({ ...row, status: "ERROR" });
      continue;
    }
    const record = row.record;
    const lookupColumn = record.category_id ? "id" : "name";
    const lookupValue = record.category_id || record.name;
    const { data: existing, error } = await supabase
      .from(target)
      .select("id, name, sort_order, updated_at")
      .eq(lookupColumn, lookupValue)
      .maybeSingle();

    if (error) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, error.message] });
      continue;
    }
    if (!record.category_id && existing) {
      rows.push({
        ...row,
        status: "ERROR",
        before: existing,
        after: record,
        errors: [...row.errors, "normalized name already exists; use its id"]
      });
      continue;
    }
    if (record.category_id && !existing) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, "id does not exist"] });
      continue;
    }
    if (existing && existing.name !== record.name) {
      const { data: duplicateName } = await supabase
        .from(target)
        .select("id")
        .eq("name", record.name)
        .maybeSingle();
      if (duplicateName && duplicateName.id !== existing.id) {
        rows.push({
          ...row,
          status: "ERROR",
          before: existing,
          after: record,
          errors: [...row.errors, "normalized name belongs to another row"]
        });
        continue;
      }
    }
    const before = existing
      ? { name: existing.name, sort_order: existing.sort_order ?? 0 }
      : null;
    const after = { name: record.name, sort_order: record.sort_order };
    rows.push(classifyExistingSheetRow(row, existing, before, after));
  }

  const summary = generalSummary(rows);
  await recordSheetJob({ jobType: "import_preview", status: "preview", sheetName: target, summary });
  return { rows, summary };
}

async function previewArtistContactsImport() {
  ensureGoogleSheetsEnabled();
  const spreadsheetId = getGoogleSheetsSpreadsheetId();
  const values = await getSheetValues(spreadsheetId, "artist_contacts!A1:D10000");
  const parsedRows = parseArtistContactSheetValues(values);
  const rows: SheetPreviewRow<ArtistContactSheetRecord>[] = [];
  const supabase = getSupabaseAdminClient() as any;

  for (const row of parsedRows) {
    if (!row.record || row.errors.length > 0) {
      rows.push({ ...row, status: "ERROR" });
      continue;
    }
    if (!(await artistExists(row.record.artist_id))) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, "artist_id does not exist"] });
      continue;
    }
    const { data: existing, error } = await supabase
      .from("artist_contacts")
      .select("artist_id, email, dm_available, updated_at")
      .eq("artist_id", row.record.artist_id)
      .maybeSingle();
    if (error) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, error.message] });
      continue;
    }
    const before = existing
      ? { email: existing.email ?? "", dm_available: existing.dm_available ?? null }
      : null;
    const after = { email: row.record.email, dm_available: row.record.dm_available };
    rows.push(classifyExistingSheetRow(row, existing, before, after));
  }

  const summary = generalSummary(rows);
  await recordSheetJob({
    jobType: "import_preview",
    status: "preview",
    sheetName: "artist_contacts",
    summary
  });
  return { rows, summary };
}

async function previewArtistCollaborationsImport() {
  ensureGoogleSheetsEnabled();
  const spreadsheetId = getGoogleSheetsSpreadsheetId();
  const values = await getSheetValues(spreadsheetId, "artist_collaborations!A1:N10000");
  const parsedRows = parseArtistCollaborationSheetValues(values);
  const rows: SheetPreviewRow<ArtistCollaborationSheetRecord>[] = [];
  const supabase = getSupabaseAdminClient() as any;

  for (const row of parsedRows) {
    if (!row.record || row.errors.length > 0) {
      rows.push({ ...row, status: "ERROR" });
      continue;
    }
    const record = row.record;
    if (!(await artistExists(record.artist_id))) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, "artist_id does not exist"] });
      continue;
    }
    const brandCategory = await resolveBrandCategory(record);
    if (brandCategory.error) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, brandCategory.error] });
      continue;
    }
    let query = supabase
      .from("artist_collaborations")
      .select(
        "id, artist_id, brand_name, brand_category_id, collaboration_year, collaboration_month, post_url, content_summary, ad_disclosure_status, likes, comments, views, updated_at"
      );
    query = record.collaboration_id
      ? query.eq("id", record.collaboration_id)
      : query.eq("artist_id", record.artist_id).eq("post_url", record.post_url);
    const { data: existing, error } = await query.maybeSingle();
    if (error) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, error.message] });
      continue;
    }
    if (record.collaboration_id && !existing) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, "collaboration_id does not exist"] });
      continue;
    }
    const after = {
      artist_id: record.artist_id,
      brand_name: record.brand_name,
      brand_category_id: brandCategory.id ?? "",
      collaboration_year: record.collaboration_year,
      collaboration_month: record.collaboration_month,
      post_url: record.post_url,
      content_summary: record.content_summary,
      ad_disclosure_status: record.ad_disclosure_status,
      likes: record.likes,
      comments: record.comments,
      views: record.views
    };
    const before = existing
      ? {
          artist_id: existing.artist_id,
          brand_name: existing.brand_name,
          brand_category_id: existing.brand_category_id ?? "",
          collaboration_year: existing.collaboration_year,
          collaboration_month: existing.collaboration_month,
          post_url: existing.post_url,
          content_summary: existing.content_summary,
          ad_disclosure_status: existing.ad_disclosure_status,
          likes: existing.likes,
          comments: existing.comments,
          views: existing.views
        }
      : null;
    rows.push(classifyExistingSheetRow(row, existing, before, after));
  }

  const summary = generalSummary(rows);
  await recordSheetJob({
    jobType: "import_preview",
    status: "preview",
    sheetName: "artist_collaborations",
    summary
  });
  return { rows, summary };
}

async function resolveBrandCategoryIds(names: string[]) {
  if (names.length === 0) return { ids: [] as string[], missing: [] as string[] };
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase.from("brand_categories").select("id, name").in("name", names);
  if (error) return { ids: [] as string[], missing: names };
  const byName = new Map((data ?? []).map((row: any) => [row.name, row.id]));
  return {
    ids: names.map((name) => byName.get(name)).filter((id): id is string => Boolean(id)),
    missing: names.filter((name) => !byName.has(name))
  };
}

async function previewArtistB2bProfilesImport() {
  ensureGoogleSheetsEnabled();
  const spreadsheetId = getGoogleSheetsSpreadsheetId();
  const values = await getSheetValues(spreadsheetId, "artist_b2b_profiles!A1:F10000");
  const parsedRows = parseArtistB2bProfileSheetValues(values);
  const rows: SheetPreviewRow<ArtistB2bProfileSheetRecord>[] = [];
  const supabase = getSupabaseAdminClient() as any;

  for (const row of parsedRows) {
    if (!row.record || row.errors.length > 0) {
      rows.push({ ...row, status: "ERROR" });
      continue;
    }
    const record = row.record;
    if (!(await artistExists(record.artist_id))) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, "artist_id does not exist"] });
      continue;
    }
    const categories = await resolveBrandCategoryIds(record.recommended_brand_categories);
    if (categories.missing.length > 0) {
      rows.push({
        ...row,
        status: "ERROR",
        errors: [...row.errors, `unknown brand categories: ${categories.missing.join(", ")}`]
      });
      continue;
    }
    const { data: existing, error } = await supabase
      .from("artist_b2b_profiles")
      .select(
        "artist_id, strengths, cautions, brand_safety_grade, updated_at, artist_recommended_brand_categories(brand_categories(name))"
      )
      .eq("artist_id", record.artist_id)
      .maybeSingle();
    if (error) {
      rows.push({ ...row, status: "ERROR", errors: [...row.errors, error.message] });
      continue;
    }
    const beforeCategories = (existing?.artist_recommended_brand_categories ?? [])
      .map((item: any) => item.brand_categories?.name)
      .filter(Boolean)
      .sort();
    const before = existing
      ? {
          recommended_brand_categories: beforeCategories,
          strengths: existing.strengths ?? "",
          cautions: existing.cautions ?? "",
          brand_safety_grade: existing.brand_safety_grade ?? "unknown"
        }
      : null;
    const after = {
      recommended_brand_categories: [...record.recommended_brand_categories].sort(),
      strengths: record.strengths,
      cautions: record.cautions,
      brand_safety_grade: record.brand_safety_grade
    };
    rows.push(classifyExistingSheetRow(row, existing, before, after));
  }

  const summary = generalSummary(rows);
  await recordSheetJob({
    jobType: "import_preview",
    status: "preview",
    sheetName: "artist_b2b_profiles",
    summary
  });
  return { rows, summary };
}

async function previewGeneralAdminSheetImport(target: AdminSheetImportTarget) {
  if (target === "categories" || target === "brand_categories") {
    return previewCategoryImport(target);
  }
  if (target === "artist_contacts") return previewArtistContactsImport();
  if (target === "artist_collaborations") return previewArtistCollaborationsImport();
  if (target === "artist_b2b_profiles") return previewArtistB2bProfilesImport();
  throw new Error(`Unsupported general sheet import target: ${target}`);
}

export async function previewAdminSheetImport(target: AdminSheetImportTarget = "artists") {
  if (target === "artist_stats") {
    return previewArtistStatsSheetImport();
  }
  if (target === "artists") {
    return previewArtistSheetImport();
  }
  return previewGeneralAdminSheetImport(target);
}

async function findMainCategoryId(name: string) {
  if (!name) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.from("categories").select("id").eq("name", name).maybeSingle();
  return data?.id ?? null;
}

async function applyArtistRecord(record: ArtistSheetRecord) {
  const supabase = getSupabaseAdminClient() as any;
  const mainCategoryId = record.main_category_id || (await findMainCategoryId(record.main_category_name));
  const payload = {
    name: record.name,
    instagram_handle: record.instagram_handle,
    main_category_id: mainCategoryId,
    bio: record.bio,
    hashtags: record.hashtags,
    search_tags: record.search_tags,
    mood_tags: record.mood_tags,
    style_tags: record.style_tags,
    topic_tags: record.topic_tags,
    thumbnail_url: record.thumbnail_url,
    character_url: record.character_url,
    gallery_post_urls: record.gallery_post_urls,
    show_on_site: record.show_on_site,
    show_growth_on_site: record.show_growth_on_site,
    is_trending: record.is_trending,
    hide_from_new: record.hide_from_new,
    status: record.status,
    sort_order: record.sort_order ?? 0,
    internal_memo: record.internal_memo
  };

  if (record.artist_id) {
    return supabase.from("artists").update(payload).eq("id", record.artist_id);
  }

  return supabase.from("artists").insert(payload);
}

export async function applyArtistSheetImport() {
  const preview = await previewArtistSheetImport();
  const errorRows = preview.rows.filter(
    (row) => row.status === "ERROR" || row.status === "CONFLICT"
  );

  if (errorRows.length > 0) {
    await recordSheetJob({
      jobType: "import_apply",
      status: "failed",
      sheetName: "artists",
      summary: preview.summary,
      errorMessage: "Preview contains validation errors."
    });
    return {
      applied: false,
      summary: preview.summary,
      errors: errorRows
    };
  }

  const results = [];
  for (const row of preview.rows) {
    if (!row.record || (row.status !== "CREATE" && row.status !== "UPDATE")) {
      continue;
    }

    const result = await applyArtistRecord(row.record);
    results.push({
      rowNumber: row.rowNumber,
      error: result.error?.message ?? null
    });
  }

  const failed = results.filter((result) => result.error);
  const summary = {
    ...preview.summary,
    appliedRows: results.length,
    failedRows: failed.length
  };
  await recordSheetJob({
    jobType: "import_apply",
    status: failed.length > 0 ? "failed" : "applied",
    sheetName: "artists",
    summary,
    errorMessage: failed.map((result) => `row ${result.rowNumber}: ${result.error}`).join("\n") || undefined
  });

  return {
    applied: failed.length === 0,
    summary,
    results
  };
}

async function applyArtistStatsRecord(record: ArtistStatsSheetRecord) {
  const supabase = getSupabaseAdminClient() as any;
  return supabase.from("artist_stats").upsert(
    {
      artist_id: record.artist_id,
      recorded_date: record.recorded_date,
      followers: record.followers,
      post_count: record.post_count
    },
    { onConflict: "artist_id,recorded_date" }
  );
}

export async function applyArtistStatsSheetImport() {
  const preview = await previewArtistStatsSheetImport();
  const errorRows = preview.rows.filter((row) => row.errors.length > 0);

  if (errorRows.length > 0) {
    await recordSheetJob({
      jobType: "import_apply",
      status: "failed",
      sheetName: "artist_stats",
      summary: preview.summary,
      errorMessage: "Preview contains validation errors."
    });
    return {
      applied: false,
      summary: preview.summary,
      errors: errorRows
    };
  }

  const results = [];
  for (const row of preview.rows) {
    if (!row.record) {
      continue;
    }

    const result = await applyArtistStatsRecord(row.record);
    results.push({
      rowNumber: row.rowNumber,
      error: result.error?.message ?? null
    });
  }

  const failed = results.filter((result) => result.error);
  const summary = {
    ...preview.summary,
    appliedRows: results.length,
    failedRows: failed.length
  };
  await recordSheetJob({
    jobType: "import_apply",
    status: failed.length > 0 ? "failed" : "applied",
    sheetName: "artist_stats",
    summary,
    errorMessage: failed.map((result) => `row ${result.rowNumber}: ${result.error}`).join("\n") || undefined
  });

  return {
    applied: failed.length === 0,
    summary,
    results
  };
}

async function applyGeneralRecord(target: AdminSheetImportTarget, record: any) {
  const supabase = getSupabaseAdminClient() as any;

  if (target === "categories" || target === "brand_categories") {
    const payload = { name: record.name, sort_order: record.sort_order };
    return record.category_id
      ? supabase.from(target).update(payload).eq("id", record.category_id)
      : supabase.from(target).insert(payload);
  }

  if (target === "artist_contacts") {
    return supabase.from("artist_contacts").upsert(
      {
        artist_id: record.artist_id,
        email: record.email || null,
        dm_available: record.dm_available
      },
      { onConflict: "artist_id" }
    );
  }

  if (target === "artist_collaborations") {
    const brandCategory = await resolveBrandCategory(record);
    if (brandCategory.error) return { error: { message: brandCategory.error } };
    const payload = {
      artist_id: record.artist_id,
      brand_name: record.brand_name,
      brand_category_id: brandCategory.id,
      collaboration_year: record.collaboration_year,
      collaboration_month: record.collaboration_month,
      post_url: record.post_url,
      content_summary: record.content_summary,
      ad_disclosure_status: record.ad_disclosure_status,
      likes: record.likes,
      comments: record.comments,
      views: record.views
    };
    return record.collaboration_id
      ? supabase.from("artist_collaborations").update(payload).eq("id", record.collaboration_id)
      : supabase
          .from("artist_collaborations")
          .upsert(payload, { onConflict: "artist_id,post_url" });
  }

  if (target === "artist_b2b_profiles") {
    const categories = await resolveBrandCategoryIds(record.recommended_brand_categories);
    if (categories.missing.length > 0) {
      return { error: { message: `unknown brand categories: ${categories.missing.join(", ")}` } };
    }
    return supabase.rpc("admin_replace_artist_b2b_profile", {
      p_artist_id: record.artist_id,
      p_strengths: record.strengths,
      p_cautions: record.cautions,
      p_brand_safety_grade: record.brand_safety_grade,
      p_brand_category_ids: categories.ids
    });
  }

  return { error: { message: `Unsupported sheet import target: ${target}` } };
}

async function applyGeneralAdminSheetImport(target: AdminSheetImportTarget) {
  const preview = await previewGeneralAdminSheetImport(target);
  const blockingRows = preview.rows.filter(
    (row) => row.status === "ERROR" || row.status === "CONFLICT"
  );
  if (blockingRows.length > 0) {
    await recordSheetJob({
      jobType: "import_apply",
      status: "failed",
      sheetName: target,
      summary: preview.summary,
      errorMessage: "Preview contains validation errors or conflicts."
    });
    return { applied: false, summary: preview.summary, errors: blockingRows };
  }

  const results = [];
  for (const row of preview.rows) {
    if (!row.record || (row.status !== "CREATE" && row.status !== "UPDATE")) continue;
    const result = await applyGeneralRecord(target, row.record);
    results.push({ rowNumber: row.rowNumber, error: result.error?.message ?? null });
  }
  const failed = results.filter((result) => result.error);
  const summary = {
    ...preview.summary,
    appliedRows: results.length,
    failedRows: failed.length
  };
  await recordSheetJob({
    jobType: "import_apply",
    status: failed.length > 0 ? "failed" : "applied",
    sheetName: target,
    summary,
    errorMessage: failed.map((result) => `row ${result.rowNumber}: ${result.error}`).join("\n") || undefined
  });
  return { applied: failed.length === 0, summary, results };
}

export async function applyAdminSheetImport(target: AdminSheetImportTarget = "artists") {
  if (target === "artist_stats") {
    return applyArtistStatsSheetImport();
  }
  if (target === "artists") {
    return applyArtistSheetImport();
  }
  return applyGeneralAdminSheetImport(target);
}

export async function listSheetSyncJobs() {
  try {
    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("sheet_sync_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return [];
    }

    return data ?? [];
  } catch {
    return [];
  }
}
