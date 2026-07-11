import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPublicArtistByHandle,
  listPublicArtists,
  listPublicArtistsByIds
} from "@/lib/server/public-artists";
import { getSupabaseAdminClient } from "@/lib/supabase";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn()
}));

type QueryMock = {
  table: string;
  data: unknown;
  error: null;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function publicArtistRow(id: string, handle: string, sortOrder = 0) {
  return {
    id,
    name: `Artist ${id}`,
    instagram_handle: handle,
    bio: "Public bio",
    hashtags: ["daily"],
    search_tags: ["search"],
    mood_tags: ["warm"],
    style_tags: ["essay"],
    topic_tags: ["work"],
    thumbnail_url: "https://example.com/thumb.png",
    character_url: "",
    gallery_post_urls: [],
    is_trending: false,
    hide_from_new: false,
    sort_order: sortOrder,
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: null,
    show_growth_on_site: true,
    main_category: { name: "daily" }
  };
}

function createQueryMock(table: string, data: unknown): QueryMock {
  const query = {
    table,
    data,
    error: null,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error: null }))
  };

  return query;
}

function setupSupabase({
  artistsData,
  statsData = []
}: {
  artistsData: unknown;
  statsData?: unknown[];
}) {
  const queries: QueryMock[] = [];
  const supabase = {
    from: vi.fn((table: string) => {
      const query = createQueryMock(table, table === "artist_stats" ? statsData : artistsData);
      queries.push(query);
      return query;
    })
  };

  vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
  return { supabase, queries };
}

function getQuery(queries: QueryMock[], table: string, occurrence = 0) {
  const matches = queries.filter((query) => query.table === table);
  const query = matches[occurrence];
  if (!query) {
    throw new Error(`Missing query for ${table} occurrence ${occurrence}`);
  }
  return query;
}

describe("public artist server queries", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseAdminClient).mockReset();
  });

  it("lists only active, show-on-site artists through explicit public columns", async () => {
    const { queries } = setupSupabase({
      artistsData: [publicArtistRow("artist-1", "public_handle")],
      statsData: [
        { artist_id: "artist-1", recorded_date: "2026-07-11", followers: 120, post_count: 12 },
        { artist_id: "artist-1", recorded_date: "2026-07-04", followers: 100, post_count: 10 }
      ]
    });

    const artists = await listPublicArtists();
    const artistQuery = getQuery(queries, "artists");
    const statsQuery = getQuery(queries, "artist_stats");
    const selectedColumns = artistQuery.select.mock.calls[0][0] as string;

    expect(artists).toHaveLength(1);
    expect(artists[0].stats.followers_delta).toBe(20);
    expect(selectedColumns).not.toContain("*");
    expect(selectedColumns).not.toContain("email");
    expect(selectedColumns).not.toContain("internal_memo");
    expect(selectedColumns).not.toContain("memo");
    expect(selectedColumns).not.toContain("is_ad");
    expect(artistQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(artistQuery.eq).toHaveBeenCalledWith("show_on_site", true);
    expect(artistQuery.order).toHaveBeenCalledWith("is_trending", { ascending: false });
    expect(artistQuery.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(statsQuery.select).toHaveBeenCalledWith("artist_id, recorded_date, followers, post_count");
    expect(statsQuery.in).toHaveBeenCalledWith("artist_id", ["artist-1"]);
  });

  it("normalizes detail handles and keeps private artists out of the detail query", async () => {
    const { queries } = setupSupabase({
      artistsData: publicArtistRow("artist-1", "mixed_handle")
    });

    const artist = await getPublicArtistByHandle("@Mixed_Handle");
    const artistQuery = getQuery(queries, "artists");

    expect(artist?.instagram_handle).toBe("mixed_handle");
    expect(artistQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(artistQuery.eq).toHaveBeenCalledWith("show_on_site", true);
    expect(artistQuery.eq).toHaveBeenCalledWith("instagram_handle", "mixed_handle");
    expect(artistQuery.maybeSingle).toHaveBeenCalled();
  });

  it("deduplicates id lookups, filters visibility, and preserves requested public artist order", async () => {
    const { queries } = setupSupabase({
      artistsData: [
        publicArtistRow("artist-2", "second_handle", 2),
        publicArtistRow("artist-1", "first_handle", 1)
      ]
    });

    const artists = await listPublicArtistsByIds(["artist-1", "artist-2", "artist-1"]);
    const artistQuery = getQuery(queries, "artists");

    expect(artists.map((artist) => artist.id)).toEqual(["artist-1", "artist-2"]);
    expect(artistQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(artistQuery.eq).toHaveBeenCalledWith("show_on_site", true);
    expect(artistQuery.in).toHaveBeenCalledWith("id", ["artist-1", "artist-2"]);
  });
});
