import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Toon-BTI visibility toggle", () => {
  it("keeps published status while switching the public maintenance state", () => {
    const manager = fs.readFileSync(
      path.join(root, "components/admin/ToonbtiManager.tsx"),
      "utf8"
    );

    expect(manager).toContain("테스트 공개");
    expect(manager).toContain("OFF · 개선 중 안내 표시");
    expect(manager).toContain("게시 전 · 검증 후 게시 필요");
    expect(manager).toContain('disabled={busy || config.test.status !== "published"}');
    expect(manager).toContain("isActive: !config.test.isActive");
    expect(manager).not.toContain(
      '{ ...config, test: { ...config.test, status: "draft", isActive: false } }'
    );
  });

  it("shows the maintenance screen unless a published active test exists", () => {
    const page = fs.readFileSync(path.join(root, "app/toonbti/page.tsx"), "utf8");
    const server = fs.readFileSync(path.join(root, "lib/server/toonbti.ts"), "utf8");

    expect(page).toContain("개선중이에요!");
    expect(server).toContain('.eq("status", "published")');
    expect(server).toContain('.eq("is_active", true)');
  });
});
