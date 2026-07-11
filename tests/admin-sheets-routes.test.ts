import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  applyAdminSheetImport,
  applyArtistSheetImport,
  exportAdminSheets,
  isAdminSheetImportTarget,
  listSheetSyncJobs,
  previewAdminSheetImport,
  previewArtistSheetImport
} from "@/lib/server/admin-sheets";
import { POST as exportSheets } from "@/app/api/admin/sheets/export/route";
import { POST as previewImport } from "@/app/api/admin/sheets/import/preview/route";
import { POST as applyImport } from "@/app/api/admin/sheets/import/apply/route";
import { GET as listJobs } from "@/app/api/admin/sheets/jobs/route";

vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthenticated: vi.fn()
}));

vi.mock("@/lib/server/admin-sheets", () => ({
  applyAdminSheetImport: vi.fn(),
  exportAdminSheets: vi.fn(),
  previewAdminSheetImport: vi.fn(),
  previewArtistSheetImport: vi.fn(),
  applyArtistSheetImport: vi.fn(),
  listSheetSyncJobs: vi.fn(),
  isAdminSheetImportTarget: vi.fn((value: string) =>
    [
      "categories",
      "brand_categories",
      "artists",
      "artist_stats",
      "artist_contacts",
      "artist_collaborations",
      "artist_b2b_profiles"
    ].includes(value)
  )
}));

describe("admin sheets API routes", () => {
  beforeEach(() => {
    vi.mocked(isAdminAuthenticated).mockReset();
    vi.mocked(exportAdminSheets).mockReset();
    vi.mocked(previewAdminSheetImport).mockReset();
    vi.mocked(previewArtistSheetImport).mockReset();
    vi.mocked(applyAdminSheetImport).mockReset();
    vi.mocked(applyArtistSheetImport).mockReset();
    vi.mocked(listSheetSyncJobs).mockReset();
  });

  it("rejects unauthenticated Google Sheets export without touching the Sheets service", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);

    const response = await exportSheets();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Unauthorized" });
    expect(exportAdminSheets).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated Google Sheets import preview without reading the sheet", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);

    const response = await previewImport(new Request("http://localhost"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Unauthorized" });
    expect(previewAdminSheetImport).not.toHaveBeenCalled();
    expect(previewArtistSheetImport).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated Google Sheets import apply without changing Supabase", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);

    const response = await applyImport(new Request("http://localhost"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Unauthorized" });
    expect(applyAdminSheetImport).not.toHaveBeenCalled();
    expect(applyArtistSheetImport).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated Google Sheets job reads", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);

    const response = await listJobs();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Unauthorized" });
    expect(listSheetSyncJobs).not.toHaveBeenCalled();
  });

  it("routes authenticated general management targets explicitly", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    vi.mocked(previewAdminSheetImport).mockResolvedValue({ rows: [], summary: { totalRows: 0 } } as never);

    const response = await previewImport(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "artist_contacts" })
      })
    );

    expect(response.status).toBe(200);
    expect(isAdminSheetImportTarget).toHaveBeenCalledWith("artist_contacts");
    expect(previewAdminSheetImport).toHaveBeenCalledWith("artist_contacts");
  });

  it("rejects unsupported sheet targets without falling back to artists", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);

    const response = await applyImport(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "unknown_tab" })
      })
    );

    expect(response.status).toBe(400);
    expect(applyAdminSheetImport).not.toHaveBeenCalled();
  });
});
