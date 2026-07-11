import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAdminSheetImport, previewAdminSheetImport } from "@/lib/server/admin-sheets";
import {
  ensureGoogleSheetsEnabled,
  getGoogleSheetsSpreadsheetId,
  getSheetValues
} from "@/lib/server/google-sheets";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  ARTIST_B2B_PROFILES_SHEET_HEADERS,
  ARTIST_COLLABORATIONS_SHEET_HEADERS,
  ARTIST_CONTACTS_SHEET_HEADERS,
  CATEGORIES_SHEET_HEADERS
} from "@/lib/sheets/artist-sheet";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/google-sheets", () => ({
  ensureGoogleSheetsEnabled: vi.fn(),
  getGoogleSheetsSpreadsheetId: vi.fn(),
  getSheetValues: vi.fn()
}));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdminClient: vi.fn() }));

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

function setupSupabase(dataByTable: Record<string, unknown>) {
  const inserts: Array<{ table: string; payload: unknown }> = [];
  const upserts: Array<{ table: string; payload: unknown; options: unknown }> = [];
  const deletes: Array<{ table: string; column: string; value: unknown }> = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const supabase = {
    rpc: vi.fn((name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ error: null });
    }),
    from: vi.fn((table: string) => {
      const query: any = {
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: dataByTable[table] ?? [], error: null }).then(resolve),
        maybeSingle: vi.fn(() =>
          Promise.resolve({ data: dataByTable[table] ?? null, error: null })
        )
      };
      return {
        select: vi.fn(() => query),
        insert: vi.fn((payload: unknown) => {
          inserts.push({ table, payload });
          return Promise.resolve({ error: null });
        }),
        upsert: vi.fn((payload: unknown, options: unknown) => {
          upserts.push({ table, payload, options });
          return Promise.resolve({ error: null });
        }),
        delete: vi.fn(() => ({
          eq: vi.fn((column: string, value: unknown) => {
            deletes.push({ table, column, value });
            return Promise.resolve({ error: null });
          })
        }))
      };
    })
  };
  vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
  return { inserts, upserts, deletes, rpcCalls };
}

describe("general Admin Sheets preview/apply", () => {
  beforeEach(() => {
    vi.mocked(getGoogleSheetsSpreadsheetId).mockReturnValue("spreadsheet-1");
    vi.mocked(getSheetValues).mockReset();
    vi.mocked(getSupabaseAdminClient).mockReset();
    vi.mocked(ensureGoogleSheetsEnabled).mockReset();
  });

  it("classifies stale category rows as conflicts without changing category data", async () => {
    const calls = setupSupabase({
      categories: {
        id: CATEGORY_ID,
        name: "일상",
        sort_order: 1,
        updated_at: "2026-07-12T00:00:00.000Z"
      }
    });
    vi.mocked(getSheetValues).mockResolvedValue([
      [...CATEGORIES_SHEET_HEADERS],
      [CATEGORY_ID, "일상", "2", "2026-07-11T00:00:00.000Z"]
    ]);

    const preview = (await previewAdminSheetImport("categories")) as {
      rows: Array<{ status: string }>;
      summary: { conflictRows: number };
    };
    expect(preview.rows[0].status).toBe("CONFLICT");
    expect(preview.summary.conflictRows).toBe(1);
    expect(calls.inserts.filter((call) => call.table === "categories")).toEqual([]);
  });

  it("applies validated new categories only after preview", async () => {
    const calls = setupSupabase({ categories: null });
    vi.mocked(getSheetValues).mockResolvedValue([
      [...CATEGORIES_SHEET_HEADERS],
      ["", "새 카테고리", "5", ""]
    ]);

    const result = await applyAdminSheetImport("categories");
    expect(result.applied).toBe(true);
    expect(calls.inserts).toContainEqual({
      table: "categories",
      payload: { name: "새 카테고리", sort_order: 5 }
    });
  });

  it("upserts tri-state contacts without deleting absent sheet rows", async () => {
    const calls = setupSupabase({ artists: { id: ARTIST_ID }, artist_contacts: null });
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTIST_CONTACTS_SHEET_HEADERS],
      [ARTIST_ID, "artist@example.com", "", ""]
    ]);

    const result = await applyAdminSheetImport("artist_contacts");
    expect(result.applied).toBe(true);
    expect(calls.upserts).toContainEqual({
      table: "artist_contacts",
      payload: { artist_id: ARTIST_ID, email: "artist@example.com", dm_available: null },
      options: { onConflict: "artist_id" }
    });
  });

  it("upserts validated collaborations by artist and post URL", async () => {
    const calls = setupSupabase({
      artists: { id: ARTIST_ID },
      brand_categories: { id: CATEGORY_ID, name: "식품" },
      artist_collaborations: null
    });
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTIST_COLLABORATIONS_SHEET_HEADERS],
      [
        "",
        ARTIST_ID,
        "브랜드",
        CATEGORY_ID,
        "식품",
        "2026",
        "7",
        "https://www.instagram.com/p/example/",
        "신제품 캠페인 릴스",
        "yes",
        "10",
        "2",
        "100",
        ""
      ]
    ]);

    const result = await applyAdminSheetImport("artist_collaborations");
    expect(result.applied).toBe(true);
    expect(calls.upserts).toContainEqual({
      table: "artist_collaborations",
      payload: expect.objectContaining({
        artist_id: ARTIST_ID,
        brand_category_id: CATEGORY_ID,
        collaboration_year: 2026,
        post_url: "https://www.instagram.com/p/example/",
        content_summary: "신제품 캠페인 릴스"
      }),
      options: { onConflict: "artist_id,post_url" }
    });
  });

  it("upserts B2B profiles and replaces only that artist's category links", async () => {
    const calls = setupSupabase({
      artists: { id: ARTIST_ID },
      brand_categories: [{ id: CATEGORY_ID, name: "식품" }],
      artist_b2b_profiles: null
    });
    vi.mocked(getSheetValues).mockResolvedValue([
      [...ARTIST_B2B_PROFILES_SHEET_HEADERS],
      [ARTIST_ID, "식품", "강점", "주의", "safe", ""]
    ]);

    const result = await applyAdminSheetImport("artist_b2b_profiles");
    expect(result.applied).toBe(true);
    expect(calls.rpcCalls).toContainEqual({
      name: "admin_replace_artist_b2b_profile",
      args: {
        p_artist_id: ARTIST_ID,
        p_strengths: "강점",
        p_cautions: "주의",
        p_brand_safety_grade: "safe",
        p_brand_category_ids: [CATEGORY_ID]
      }
    });
    expect(calls.deletes).toEqual([]);
  });
});
