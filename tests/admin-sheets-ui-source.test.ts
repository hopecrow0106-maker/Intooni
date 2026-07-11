import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const adminPageSource = readFileSync(join(process.cwd(), "app/admin/page.tsx"), "utf8");

describe("admin Google Sheets UI wiring", () => {
  it("exposes export, preview, and apply operations from the admin page", () => {
    expect(adminPageSource).toContain("/api/admin/sheets/export");
    expect(adminPageSource).toContain("/api/admin/sheets/import/preview");
    expect(adminPageSource).toContain("/api/admin/sheets/import/apply");
  });

  it("requires an explicit artist_stats target for manual stats imports", () => {
    expect(adminPageSource).toContain('body: { sheet: "artist_stats" }');
    expect(adminPageSource).toContain("Apply artist_stats rows to official Supabase stats");
  });

  it("offers every general management tab through one preview/apply selector", () => {
    for (const target of [
      "artists",
      "categories",
      "brand_categories",
      "artist_contacts",
      "artist_collaborations",
      "artist_b2b_profiles"
    ]) {
      expect(adminPageSource).toContain(`value: "${target}"`);
    }
    expect(adminPageSource).toContain('onRun("previewGeneral", selectedTarget)');
    expect(adminPageSource).toContain('onRun("applyGeneral", selectedTarget)');
    expect(adminPageSource).toContain("Before / after");
    expect(adminPageSource).toContain("row.errors");
  });
});
