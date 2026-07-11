import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const categoryRoute = read("app/api/categories/route.ts");
const magazineRoute = read("app/api/magazines/route.ts");
const toonRoute = read("app/api/admin/toon-tests/route.ts");
const toonBuilder = read("components/admin/ToonbtiRouteMapBuilder.tsx");
const detailsRoute = read("app/api/admin/artists/[id]/details/route.ts");
const internalManager = read("components/admin/ArtistInternalManager.tsx");
const adminPage = read("app/admin/page.tsx");
const artistForm = read("components/admin/ArtistForm.tsx");

describe("Admin pre-migration compatibility and workspace layout", () => {
  it("falls back to legacy category and magazine reads without exposing raw failures", () => {
    expect(categoryRoute).toContain('.select("id, name, sort_order, created_at")');
    expect(categoryRoute).toContain("updated_at: category.created_at");
    expect(magazineRoute).toContain("could not find a relationship");
    expect(magazineRoute).toContain("related_artist_ids");
    expect(magazineRoute).toContain("legacyResult");
  });

  it("opens unavailable ToonBTI and internal schemas in a safe preparation state", () => {
    expect(toonRoute).toContain("storageAvailable: false");
    expect(toonBuilder).toContain('saveState === "unavailable"');
    expect(toonBuilder).not.toContain("localStorage");
    expect(detailsRoute).toContain("isMissingInternalSchema");
    expect(detailsRoute).toContain("storageAvailable: false");
    expect(internalManager).toContain("내부 데이터 저장소 준비 필요");
    expect(internalManager).toContain("storageAvailable && activeTab");
  });

  it("separates artist management, internal editing, and data synchronization", () => {
    expect(adminPage).toContain('key: "data"');
    expect(adminPage).toContain("시트의 변경 내용은 자동 반영되지 않습니다");
    expect(adminPage).toContain("시트로 내보내기");
    expect(adminPage).toContain("변경 미리보기");
    expect(adminPage).toContain("검증 후 반영");
    expect(artistForm).toContain('type ArtistEditorTab = "profile" | "media" | "internal"');
    expect(artistForm).toContain("공개 프로필 미리보기");
    expect(artistForm).toContain("목록으로");
  });
});
