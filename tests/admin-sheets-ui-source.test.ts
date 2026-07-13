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
    expect(adminPageSource).toContain("시트의 통계 이력을 운영 DB에 반영할까요?");
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
    expect(adminPageSource).toContain("운영 DB 현재값 → 시트 변경값");
    expect(adminPageSource).toContain("확인 필요는 데이터 손상을 막기 위한 보호 상태입니다.");
    expect(adminPageSource).toContain("row.errors");
  });
});
