import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Toon-BTI admin test preview", () => {
  it("organizes questions by axis and exposes the preview action", () => {
    const manager = fs.readFileSync(
      path.join(root, "components/admin/ToonbtiManager.tsx"),
      "utf8"
    );

    expect(manager).toContain("축별 질문 설계");
    expect(manager).toContain("작성 완료");
    expect(manager).toContain("질문과 응답 분류");
    expect(manager).toContain("예상 테스트 실시하기");
    expect(manager).toContain("<ToonbtiTestPreview");
  });

  it("calculates a result without writing analytics or browser state", () => {
    const preview = fs.readFileSync(
      path.join(root, "components/admin/ToonbtiTestPreview.tsx"),
      "utf8"
    );

    expect(preview).toContain("Admin Preview");
    expect(preview).toContain("calculateToonbtiResult");
    expect(preview).toContain("통계와 운영 DB에는");
    expect(preview).toContain("관리자 확인");
    expect(preview).toContain("previewCharacterUrls");
    expect(preview).toContain("characterUrls={previewCharacterUrls}");
    expect(preview).not.toContain("/api/toonbti-events");
    expect(preview).not.toContain("localStorage");
  });
});
