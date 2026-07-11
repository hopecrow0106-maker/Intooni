import { beforeEach, describe, expect, it, vi } from "vitest";

import { exportAdminSheets } from "@/lib/server/admin-sheets";
import {
  clearSheetRange,
  ensureGoogleSheetsEnabled,
  getGoogleSheetsSpreadsheetId,
  updateSheetValues
} from "@/lib/server/google-sheets";
import { getSupabaseAdminClient } from "@/lib/supabase";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/google-sheets", () => ({
  clearSheetRange: vi.fn(() => Promise.resolve()),
  ensureGoogleSheetsEnabled: vi.fn(),
  getGoogleSheetsSpreadsheetId: vi.fn(),
  updateSheetValues: vi.fn(() => Promise.resolve())
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn()
}));

type SelectCall = {
  table: string;
  columns: string;
};

function setupSupabase() {
  const selects: SelectCall[] = [];
  const inserts: Array<{ table: string; payload: unknown }> = [];
  const tableData: Record<string, unknown[]> = {
    categories: [
      {
        id: "category-1",
        name: "daily",
        sort_order: 1,
        created_at: "2026-07-10T00:00:00.000Z",
        updated_at: "2026-07-11T00:00:00.000Z"
      }
    ],
    brand_categories: [],
    artists: [
      {
        id: "artist-1",
        name: "Export Artist",
        instagram_handle: "export_artist",
        bio: "Public bio",
        hashtags: ["daily"],
        search_tags: ["slice"],
        mood_tags: [],
        style_tags: [],
        topic_tags: [],
        thumbnail_url: "",
        character_url: "",
        gallery_post_urls: [],
        show_on_site: true,
        show_growth_on_site: false,
        is_trending: true,
        hide_from_new: false,
        status: "active",
        sort_order: 7,
        internal_memo: "private memo",
        created_at: "2026-07-09T00:00:00.000Z",
        updated_at: "2026-07-11T01:00:00.000Z",
        main_category: { name: "daily" }
      }
    ],
    artist_stats: [],
    artist_contacts: [],
    artist_collaborations: [],
    artist_b2b_profiles: []
  };

  const supabase = {
    from: vi.fn((table: string) => ({
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return Promise.resolve({ error: null });
      }),
      select: vi.fn((columns: string) => {
        selects.push({ table, columns });
        return {
          order: vi.fn(() => {
            if (table === "artist_stats") {
              return {
                limit: vi.fn(() => Promise.resolve({ data: tableData[table], error: null }))
              };
            }

            return Promise.resolve({ data: tableData[table], error: null });
          })
        };
      })
    }))
  };

  vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
  return { selects, inserts };
}

function valuesForRange(range: string) {
  const match = vi
    .mocked(updateSheetValues)
    .mock.calls.find(([spreadsheetId, targetRange]) => spreadsheetId === "spreadsheet-1" && targetRange === range);
  if (!match) {
    throw new Error(`Missing updateSheetValues call for ${range}`);
  }

  return match[2] as string[][];
}

describe("admin sheets export workflow", () => {
  beforeEach(() => {
    vi.mocked(clearSheetRange).mockClear();
    vi.mocked(ensureGoogleSheetsEnabled).mockClear();
    vi.mocked(getGoogleSheetsSpreadsheetId).mockReset();
    vi.mocked(updateSheetValues).mockClear();
    vi.mocked(getSupabaseAdminClient).mockReset();
    vi.mocked(getGoogleSheetsSpreadsheetId).mockReturnValue("spreadsheet-1");
  });

  it("exports additive category timestamps and resolved artist category names", async () => {
    const { selects, inserts } = setupSupabase();

    const summary = await exportAdminSheets();
    const categoryValues = valuesForRange("categories!A1");
    const artistValues = valuesForRange("artists!A1");
    const categorySelect = selects.find((call) => call.table === "categories")?.columns ?? "";
    const artistSelect = selects.find((call) => call.table === "artists")?.columns ?? "";

    expect(summary).toMatchObject({ categories: 1, artists: 1 });
    expect(categorySelect).toContain("updated_at");
    expect(artistSelect).toContain("main_category:categories!artists_main_category_id_fkey(id, name)");
    expect(artistSelect).not.toContain("hidden_tags");
    expect(artistSelect).not.toContain("is_hot");
    expect(categoryValues[0]).toEqual(["category_id", "name", "sort_order", "updated_at"]);
    expect(categoryValues[1]).toEqual([
      "category-1",
      "daily",
      1,
      "2026-07-11T00:00:00.000Z"
    ]);
    expect(artistValues[0][3]).toBe("main_category_id");
    expect(artistValues[0][4]).toBe("main_category_name");
    expect(artistValues[1][4]).toBe("daily");
    expect(inserts).toContainEqual(
      expect.objectContaining({
        table: "sheet_sync_jobs",
        payload: expect.objectContaining({
          job_type: "export",
          status: "applied",
          spreadsheet_id: "spreadsheet-1"
        })
      })
    );
  });
});
