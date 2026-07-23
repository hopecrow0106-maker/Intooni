import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const adminSource = readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
const publicSource = readFileSync(path.join(root, "app/toonbti/page.tsx"), "utf8");
const managerSource = readFileSync(path.join(root, "components/admin/ToonbtiManager.tsx"), "utf8");
const runnerSource = readFileSync(path.join(root, "components/toonbti/ToonTestRunner.tsx"), "utf8");
const artistFormSource = readFileSync(path.join(root, "components/admin/ArtistForm.tsx"), "utf8");
const artistAssignmentSource = readFileSync(
  path.join(root, "components/admin/ArtistToonbtiAssignment.tsx"),
  "utf8"
);

describe("ToonBTI scoring model transition", () => {
  it("keeps removed legacy tag APIs out while installing the normalized manager", () => {
    expect(existsSync(path.join(root, "components/admin/ToonbtiManager.tsx"))).toBe(true);
    expect(existsSync(path.join(root, "components/admin/ToonbtiTagManager.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "app/api/toonbti/route.ts"))).toBe(false);
    expect(adminSource).not.toContain("ToonbtiTagManager");
    expect(adminSource).toContain("ToonbtiManager");
    expect(adminSource).not.toContain("ToonbtiRouteMapBuilder");
    expect(adminSource).not.toContain("episode_formats");
    expect(publicSource).not.toContain("episode_formats");
  });

  it("uses the four-axis manager and score-based public runner", () => {
    expect(managerSource).toContain('type ManagerTab = "axes" | "questions" | "results" | "artists"');
    expect(managerSource).not.toContain('{ id: "settings", label: "기본 설정" }');
    expect(managerSource).toContain('{ id: "questions", label: "2. 질문·답변" }');
    expect(managerSource).toContain("getPossibleToonbtiCodes");
    expect(managerSource).toContain("CANONICAL_TOONBTI_AXES");
    expect(managerSource).toContain("고정 4축 불러오기");
    expect(managerSource).toContain("/api/admin/toonbti/assignments");
    expect(runnerSource).toContain("calculateToonbtiResult");
    expect(runnerSource).toContain("window.localStorage");
    expect(publicSource).toContain("getPublishedToonbtiConfig");
  });

  it("does not expose the retired Tone, style, and topic tag editor as Toon-BTI", () => {
    expect(artistFormSource).not.toContain('label="툰비티아이 Tone"');
    expect(artistFormSource).not.toContain('label="툰비티아이 그림체"');
    expect(artistFormSource).not.toContain('label="툰비티아이 주제"');
  });

  it("assigns the four-axis Toon-BTI from each artist basic information screen", () => {
    expect(artistFormSource).toContain("ArtistToonbtiAssignment");
    expect(artistAssignmentSource).toContain("getActiveToonbtiAxes");
    expect(artistAssignmentSource).toContain("getActiveTraitsForAxis");
    expect(artistAssignmentSource).toContain("/api/admin/toonbti/assignments");
    expect(artistAssignmentSource).toContain("검색 태그와는 별개입니다.");
  });
});
