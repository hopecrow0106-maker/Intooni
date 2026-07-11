import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyArtistSheetImport,
  applyArtistStatsSheetImport,
  previewArtistSheetImport,
  previewArtistStatsSheetImport
} from "@/lib/server/admin-sheets";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { ARTIST_STATS_SHEET_HEADERS, ARTISTS_SHEET_HEADERS } from "@/lib/sheets/artist-sheet";
import {
  ensureGoogleSheetsEnabled,
  getGoogleSheetsSpreadsheetId,
  getSheetValues
} from "@/lib/server/google-sheets";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/google-sheets", () => ({
  ensureGoogleSheetsEnabled: vi.fn(),
  getGoogleSheetsSpreadsheetId: vi.fn(),
  getSheetValues: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn()
}));

function validArtistRow(overrides: Partial<Record<(typeof ARTISTS_SHEET_HEADERS)[number], string>> = {}) {
  const values: Record<string, string> = {
    artist_id: "artist-1",
    name: "Sheet Artist",
    instagram_handle: "@Sheet_Handle",
    main_category_id: "",
    main_category_name: "daily",
    bio: "Public bio",
    hashtags: "daily|toon",
    search_tags: "search",
    mood_tags: "warm",
    style_tags: "essay",
    topic_tags: "work",
    thumbnail_url: "https://example.com/thumb.png",
    character_url: "",
    gallery_post_urls: "https://www.instagram.com/p/example/",
    show_on_site: "true",
    show_growth_on_site: "true",
    is_trending: "false",
    hide_from_new: "false",
    status: "active",
    sort_order: "3",
    internal_memo: "Internal note",
    source_updated_at: "2026-07-11T00:00:00.000Z",
    ...overrides
  };

  return ARTISTS_SHEET_HEADERS.map((header) => values[header] ?? "");
}

function setupSupabase() {
  const calls = {
    inserts: [] as Array<{ table: string; payload: unknown }>,
    upserts: [] as Array<{ table: string; payload: unknown; options: unknown }>,
    updates: [] as Array<{ table: string; payload: unknown }>,
    eqs: [] as Array<{ table: string; column: string; value: unknown }>,
    selects: [] as Array<{ table: string; columns: string }>
  };

  const supabase = {
    from: vi.fn((table: string) => ({
      insert: vi.fn((payload: unknown) => {
        calls.inserts.push({ table, payload });
        return Promise.resolve({ error: null });
      }),
      upsert: vi.fn((payload: unknown, options: unknown) => {
        calls.upserts.push({ table, payload, options });
        return Promise.resolve({ error: null });
      }),
      update: vi.fn((payload: unknown) => {
        calls.updates.push({ table, payload });
        return {
          eq: vi.fn((column: string, value: unknown) => {
            calls.eqs.push({ table, column, value });
            return Promise.resolve({ error: null });
          })
        };
      }),
      select: vi.fn((columns: string) => {
        calls.selects.push({ table, columns });
        return {
          eq: vi.fn((column: string, value: unknown) => {
            calls.eqs.push({ table, column, value });
            const data =
              table === "categories"
                ? { id: "category-1", name: "daily" }
                : table === "artists"
                  ? {
                      id: "artist-1",
                      name: "Sheet Artist",
                      instagram_handle: "sheet_handle",
                      main_category_id: "category-1",
                      bio: "Old bio",
                      hashtags: ["daily", "toon"],
                      search_tags: ["search"],
                      mood_tags: ["warm"],
                      style_tags: ["essay"],
                      topic_tags: ["work"],
                      thumbnail_url: "https://example.com/thumb.png",
                      character_url: "",
                      gallery_post_urls: ["https://www.instagram.com/p/example/"],
                      show_on_site: true,
                      show_growth_on_site: true,
                      is_trending: false,
                      hide_from_new: false,
                      status: "active",
                      sort_order: 3,
                      internal_memo: "Internal note",
                      updated_at: "2026-07-11T00:00:00.000Z"
                    }
                  : null;
            return {
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data,
                  error: null
                })
              )
            };
          })
        };
      })
    }))
  };

  vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
  return calls;
}

describe("admin sheets import workflow", () => {
  beforeEach(() => {
    vi.mocked(ensureGoogleSheetsEnabled).mockReset();
    vi.mocked(getGoogleSheetsSpreadsheetId).mockReset();
    vi.mocked(getSheetValues).mockReset();
    vi.mocked(getSupabaseAdminClient).mockReset();
    vi.mocked(getGoogleSheetsSpreadsheetId).mockReturnValue("spreadsheet-1");
  });

  it("preview parses and summarizes sheet rows without mutating artist source data", async () => {
    const calls = setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([[...ARTISTS_SHEET_HEADERS], validArtistRow()]);

    const preview = await previewArtistSheetImport();

    expect(ensureGoogleSheetsEnabled).toHaveBeenCalled();
    expect(getSheetValues).toHaveBeenCalledWith("spreadsheet-1", "artists!A1:V10000");
    expect(preview.summary).toMatchObject({
      totalRows: 1,
      validRows: 1,
      errorRows: 0,
      updateRows: 1
    });
    expect(calls.updates.filter((call) => call.table === "artists")).toEqual([]);
    expect(calls.inserts.filter((call) => call.table === "artists")).toEqual([]);
  });

  it("apply stops before artist writes when preview contains validation errors", async () => {
    const calls = setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTISTS_SHEET_HEADERS],
      validArtistRow({ name: "", instagram_handle: "", show_on_site: "maybe" })
    ]);

    const result = await applyArtistSheetImport();

    expect(result.applied).toBe(false);
    expect(result.summary.errorRows).toBe(1);
    expect(calls.updates.filter((call) => call.table === "artists")).toEqual([]);
    expect(calls.inserts.filter((call) => call.table === "artists")).toEqual([]);
    expect(calls.selects.filter((call) => call.table === "categories")).toEqual([]);
  });

  it("apply writes only validated artist rows after resolving the category id", async () => {
    const calls = setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([[...ARTISTS_SHEET_HEADERS], validArtistRow()]);

    const result = await applyArtistSheetImport();
    const summary = result.summary as typeof result.summary & { appliedRows: number };

    expect(result.applied).toBe(true);
    expect(summary.appliedRows).toBe(1);
    expect(calls.selects).toContainEqual({ table: "categories", columns: "id" });
    expect(calls.eqs).toContainEqual({ table: "categories", column: "name", value: "daily" });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].table).toBe("artists");
    expect(calls.updates[0].payload).toMatchObject({
      name: "Sheet Artist",
      instagram_handle: "sheet_handle",
      main_category_id: "category-1",
      show_on_site: true,
      status: "active"
    });
    expect(calls.eqs).toContainEqual({ table: "artists", column: "id", value: "artist-1" });
  });

  it("classifies stale sheet rows as conflicts and blocks apply", async () => {
    const calls = setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTISTS_SHEET_HEADERS],
      validArtistRow({ source_updated_at: "2026-07-10T00:00:00.000Z" })
    ]);

    const preview = await previewArtistSheetImport();
    expect(preview.rows[0].status).toBe("CONFLICT");
    expect(preview.summary.conflictRows).toBe(1);

    const result = await applyArtistSheetImport();
    expect(result.applied).toBe(false);
    expect(calls.updates.filter((call) => call.table === "artists")).toEqual([]);
  });

  it("classifies unchanged rows without writing them", async () => {
    const calls = setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTISTS_SHEET_HEADERS],
      validArtistRow({ bio: "Old bio" })
    ]);

    const preview = await previewArtistSheetImport();
    expect(preview.rows[0].status).toBe("NO_CHANGE");
    expect(preview.summary.noChangeRows).toBe(1);

    const result = await applyArtistSheetImport();
    expect(result.applied).toBe(true);
    expect(calls.updates.filter((call) => call.table === "artists")).toEqual([]);
  });

  it("rejects blank-id rows when the normalized handle already exists", async () => {
    setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTISTS_SHEET_HEADERS],
      validArtistRow({ artist_id: "" })
    ]);

    const preview = await previewArtistSheetImport();
    expect(preview.rows[0].status).toBe("ERROR");
    expect(preview.rows[0].errors).toContain("instagram_handle already exists; use its artist_id");
  });

  it("artist stats preview validates rows without mutating official stats", async () => {
    const calls = setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTIST_STATS_SHEET_HEADERS],
      ["artist-1", "2026-07-10", "1234", "56"]
    ]);

    const preview = await previewArtistStatsSheetImport();

    expect(getSheetValues).toHaveBeenCalledWith("spreadsheet-1", "artist_stats!A1:D10000");
    expect(preview.summary).toMatchObject({
      totalRows: 1,
      validRows: 1,
      errorRows: 0,
      upsertRows: 1
    });
    expect(calls.upserts).toEqual([]);
    expect(calls.inserts.filter((call) => call.table === "artist_stats")).toEqual([]);
  });

  it("artist stats apply stops before lookup or upsert when validation errors exist", async () => {
    const calls = setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTIST_STATS_SHEET_HEADERS],
      ["", "20260710", "-1", "bad"]
    ]);

    const result = await applyArtistStatsSheetImport();

    expect(result.applied).toBe(false);
    expect(result.summary.errorRows).toBe(1);
    expect(calls.selects.filter((call) => call.table === "artists")).toEqual([]);
    expect(calls.upserts).toEqual([]);
  });

  it("artist stats apply upserts by artist/date only after validation passes", async () => {
    const calls = setupSupabase();
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTIST_STATS_SHEET_HEADERS],
      ["artist-1", "2026-07-10", "1234", "56"]
    ]);

    const result = await applyArtistStatsSheetImport();
    const summary = result.summary as typeof result.summary & { appliedRows: number };

    expect(result.applied).toBe(true);
    expect(summary.appliedRows).toBe(1);
    expect(calls.upserts).toEqual([
      {
        table: "artist_stats",
        payload: {
          artist_id: "artist-1",
          recorded_date: "2026-07-10",
          followers: 1234,
          post_count: 56
        },
        options: { onConflict: "artist_id,recorded_date" }
      }
    ]);
  });
});
