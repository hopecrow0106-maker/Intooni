import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const internalManager = readFileSync(
  path.join(root, "components/admin/ArtistInternalManager.tsx"),
  "utf8"
);
const adminPage = readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
const artistTable = readFileSync(path.join(root, "components/admin/ArtistTable.tsx"), "utf8");
const artistForm = readFileSync(path.join(root, "components/admin/ArtistForm.tsx"), "utf8");

describe("Admin artist management surface", () => {
  it("provides internal-only stats, contact, collaboration, and B2B sections", () => {
    for (const text of [
      "내부 전용 정보",
      "통계",
      "연락정보",
      "협업 이력",
      "협업 내용",
      "B2B 분석",
      "오늘 통계 기록",
      "브랜드 세이프티 등급"
    ]) {
      expect(internalManager).toContain(text);
    }
    expect(internalManager).toContain("같은 날짜의 통계가 있습니다");
    expect(internalManager).toContain("/stats");
    expect(internalManager).toContain("/contact");
    expect(internalManager).toContain("/collaborations");
    expect(internalManager).toContain("/b2b");
  });

  it("does not add forbidden collection fields to the internal manager", () => {
    for (const identifier of [
      "expected_rate",
      "response_speed",
      "inquiry_link",
      "manager_contact",
      "portfolio_url",
      "content_format",
      "collaboration_evidence",
      "collaboration_confidence"
    ]) {
      expect(internalManager).not.toContain(identifier);
    }
  });

  it("supports the required list filters and labels normal removal as archive", () => {
    for (const state of [
      "visibilityFilter",
      "statusFilter",
      "growthFilter",
      "trendingFilter",
      "categoryFilter",
      "internalDataFilter"
    ]) {
      expect(adminPage).toContain(state);
    }
    expect(adminPage).toContain("연락정보 있음");
    expect(adminPage).toContain("협업 있음");
    expect(adminPage).toContain("B2B 있음");
    expect(adminPage).toContain("toggleArchivedArtistFilter");
    expect(adminPage).toContain('setStatusFilter("archived")');
    expect(adminPage).toContain("보관 처리된 작가 · 클릭해서 보기");
    expect(adminPage).toContain("toggleHiddenArtistFilter");
    expect(adminPage).toContain('setStatusFilter("hidden")');
    expect(adminPage).toContain("숨김 처리된 작가 · 클릭해서 보기");
    expect(adminPage).toContain("rankedArtistChartItems");
    expect(adminPage).toContain('.filter((item) => item.status === "active")');
    expect(adminPage).toContain("대표 게시물 링크 누락");
    expect(adminPage).toContain('selectDataEnrichmentCategory("gallery-posts")');
    expect(adminPage).toContain("필터 초기화");
    expect(artistTable).toContain("대표 게시물 {galleryPostCount}/4");
    expect(artistTable).toContain("보관");
    expect(artistTable).not.toContain(">\n                          삭제\n");
  });

  it("explains public and growth visibility independently", () => {
    expect(artistForm).toContain("웹사이트 공개 OFF");
    expect(artistForm).toContain("공개 사이트, 상세 페이지, 검색");
    expect(artistForm).toContain("성장률 공개 OFF");
    expect(artistForm).toContain("통계 수집은 계속");
  });

  it("wires public visibility toggles to a consistent saved status", () => {
    expect(artistTable).toContain("onToggleVisibility");
    expect(artistTable).toContain("onClick={() => onToggleVisibility(artist)}");
    expect(adminPage).toContain("toggleSiteVisibility");
    expect(adminPage).toContain("show_on_site: nextVisibility");
    expect(artistForm).toContain('status: showOnSite ? "active" : "hidden"');
    expect(artistForm).toContain('show_on_site: status === "active"');
  });
});
