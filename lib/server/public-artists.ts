import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  assertNoForbiddenPublicArtistKeys,
  toPublicArtistDTO,
  type PublicArtistDTO
} from "@/lib/domain/public-artist";

const PUBLIC_ARTIST_COLUMNS = `
  id,
  name,
  instagram_handle,
  bio,
  hashtags,
  search_tags,
  mood_tags,
  style_tags,
  topic_tags,
  thumbnail_url,
  character_url,
  gallery_post_urls,
  is_trending,
  hide_from_new,
  sort_order,
  created_at,
  updated_at,
  show_growth_on_site,
  main_category:categories!artists_main_category_id_fkey(name)
`;

const LEGACY_PUBLIC_ARTIST_COLUMNS = `
  id,
  name,
  instagram_handle,
  genre,
  bio,
  hashtags,
  hidden_tags,
  mood_tags,
  style_tags,
  topic_tags,
  thumbnail_url,
  character_url,
  gallery_post_urls,
  is_hot,
  hide_from_new,
  sort_order,
  created_at,
  followers,
  post_count
`;

type PublicArtistQueryRow = {
  id: string;
  name: string;
  instagram_handle: string;
  bio: string | null;
  hashtags: string[] | null;
  search_tags: string[] | null;
  mood_tags: string[] | null;
  style_tags: string[] | null;
  topic_tags: string[] | null;
  thumbnail_url: string | null;
  character_url: string | null;
  gallery_post_urls: string[] | null;
  is_trending: boolean | null;
  hide_from_new: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
  show_growth_on_site: boolean | null;
  main_category: { name: string | null } | null;
};

type ArtistStatQueryRow = {
  artist_id: string;
  recorded_date: string;
  followers: number;
  post_count: number;
};

function normalizeHandle(value: string) {
  return decodeURIComponent(value).replace(/^@/, "").trim().toLowerCase();
}

function assertPublicPayload(payload: unknown) {
  const forbiddenKeys = assertNoForbiddenPublicArtistKeys(payload);
  if (forbiddenKeys.length > 0) {
    throw new Error(`Public artist payload contains forbidden key(s): ${forbiddenKeys.join(", ")}`);
  }
}

async function getStatsByArtistId(artistIds: string[]) {
  const uniqueArtistIds = Array.from(new Set(artistIds)).filter(Boolean);
  const statsByArtistId = new Map<string, ArtistStatQueryRow[]>();
  const pageSize = 1000;

  if (uniqueArtistIds.length === 0) {
    return statsByArtistId;
  }

  const supabase = getSupabaseAdminClient();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("artist_stats" as never)
      .select("artist_id, recorded_date, followers, post_count")
      .in("artist_id", uniqueArtistIds)
      .order("recorded_date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Public artist_stats query failed", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return new Map<string, ArtistStatQueryRow[]>();
    }

    const rows = (data ?? []) as unknown as ArtistStatQueryRow[];
    for (const row of rows) {
      const current = statsByArtistId.get(row.artist_id) ?? [];
      if (current.length < 2) {
        current.push(row);
        statsByArtistId.set(row.artist_id, current);
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return statsByArtistId;
}

function mapPublicArtists(
  rows: PublicArtistQueryRow[],
  statsByArtistId: Map<string, ArtistStatQueryRow[]>
) {
  const artists = rows.map((row) => toPublicArtistDTO(row, statsByArtistId.get(row.id) ?? []));
  assertPublicPayload(artists);
  return artists;
}

export async function listPublicArtists(): Promise<PublicArtistDTO[]> {
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("artists")
    .select(PUBLIC_ARTIST_COLUMNS)
    .eq("status", "active")
    .eq("show_on_site", true)
    .order("is_trending", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("artists")
      .select(LEGACY_PUBLIC_ARTIST_COLUMNS)
      .order("is_hot", { ascending: false })
      .order("sort_order", { ascending: true });

    if (legacyError) {
      throw error;
    }

    return mapPublicArtists((legacyData ?? []) as unknown as PublicArtistQueryRow[], new Map());
  }

  const rows = (data ?? []) as unknown as PublicArtistQueryRow[];
  const statsByArtistId = await getStatsByArtistId(rows.map((row) => row.id));
  return mapPublicArtists(rows, statsByArtistId);
}

export async function getPublicArtistByHandle(handle: string): Promise<PublicArtistDTO | null> {
  const normalizedHandle = normalizeHandle(handle);
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("artists")
    .select(PUBLIC_ARTIST_COLUMNS)
    .eq("status", "active")
    .eq("show_on_site", true)
    .eq("instagram_handle", normalizedHandle)
    .maybeSingle();

  if (error) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("artists")
      .select(LEGACY_PUBLIC_ARTIST_COLUMNS)
      .eq("instagram_handle", normalizedHandle)
      .maybeSingle();

    if (legacyError) {
      throw error;
    }

    if (!legacyData) {
      return null;
    }

    const artist = toPublicArtistDTO(legacyData as unknown as PublicArtistQueryRow, []);
    assertPublicPayload(artist);
    return artist;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as PublicArtistQueryRow;
  const statsByArtistId = await getStatsByArtistId([row.id]);
  const artist = toPublicArtistDTO(row, statsByArtistId.get(row.id) ?? []);
  assertPublicPayload(artist);
  return artist;
}

export async function listPublicArtistsByIds(artistIds: string[]): Promise<PublicArtistDTO[]> {
  const uniqueArtistIds = Array.from(new Set(artistIds)).filter(Boolean);
  if (uniqueArtistIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("artists")
    .select(PUBLIC_ARTIST_COLUMNS)
    .eq("status", "active")
    .eq("show_on_site", true)
    .in("id", uniqueArtistIds);

  if (error) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("artists")
      .select(LEGACY_PUBLIC_ARTIST_COLUMNS)
      .in("id", uniqueArtistIds);

    if (legacyError) {
      throw error;
    }

    const mapped = mapPublicArtists((legacyData ?? []) as unknown as PublicArtistQueryRow[], new Map());
    const orderMap = new Map(uniqueArtistIds.map((id, index) => [id, index]));
    return mapped.sort((left, right) => (orderMap.get(left.id) ?? 9999) - (orderMap.get(right.id) ?? 9999));
  }

  const rows = (data ?? []) as unknown as PublicArtistQueryRow[];
  const statsByArtistId = await getStatsByArtistId(rows.map((row) => row.id));
  const mapped = mapPublicArtists(rows, statsByArtistId);
  const orderMap = new Map(uniqueArtistIds.map((id, index) => [id, index]));
  return mapped.sort((left, right) => (orderMap.get(left.id) ?? 9999) - (orderMap.get(right.id) ?? 9999));
}
