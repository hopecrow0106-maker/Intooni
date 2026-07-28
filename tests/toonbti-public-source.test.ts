import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const runner = read("components/toonbti/ToonTestRunner.tsx");
const testCanvas = read("components/toonbti/ToonbtiTestCanvas.tsx");
const resultPage = read("app/toonbti/result/[resultCode]/page.tsx");
const resultActions = read("components/toonbti/ToonbtiResultActions.tsx");
const artistCard = read("components/toonbti/ToonbtiArtistCard.tsx");
const manager = read("components/admin/ToonbtiManager.tsx");
const imageRoute = read("app/api/toonbti-image/route.ts");

describe("Toon-BTI public and admin feature wiring", () => {
  it("provides one-question progress, back navigation, persistence, and central calculation", () => {
    expect(runner).toContain("questionIndex + 1");
    expect(runner).toContain("ToonbtiQuestionCanvas");
    expect(testCanvas).toContain("이전");
    expect(testCanvas).toContain('Q {String(questionNumber).padStart(2, "0")}');
    expect(testCanvas).toContain("totalQuestions");
    expect(runner).not.toContain("관리자 확인");
    expect(runner).toContain("window.localStorage");
    expect(runner).toContain("calculateToonbtiResult");
    expect(runner).toContain("/toonbti/result/");
    expect(runner).toContain("characterUrls");
    expect(testCanvas).toContain("toonbti-floating-character");
    expect(testCanvas).toContain("toonbti-character-float");
  });

  it("renders DB-driven result details and exact matching public artists", () => {
    expect(resultPage).toContain("getPublishedToonbtiResult");
    expect(resultPage).toContain("trait.description");
    expect(resultPage).toContain("data.artists.map");
    expect(artistCard).toContain("artist.thumbnail_url");
    expect(artistCard).toContain("artist.instagram_handle");
  });

  it("creates a share card, falls back to link copy, and supports restart", () => {
    expect(resultActions).toContain('canvas.width = 1080');
    expect(resultActions).toContain("createImageBitmap");
    expect(resultActions).toContain("navigator.share");
    expect(resultActions).toContain("navigator.clipboard.writeText");
    expect(resultActions).toContain("toonbti_restart");
    expect(imageRoute).toContain("MAX_IMAGE_BYTES");
    expect(imageRoute).toContain("/storage/v1/object/public/");
  });

  it("keeps axis meanings DB-managed and assigns artists with grouped trait buttons", () => {
    expect(manager).toContain("getActiveTraitsForAxis");
    expect(manager).toContain("selectedTraitIds");
    expect(manager).toContain("선택 결과");
    expect(manager).not.toContain("현실형");
    expect(manager).not.toContain("스토리형");
    expect(manager).not.toContain("포인트형");
  });
});
