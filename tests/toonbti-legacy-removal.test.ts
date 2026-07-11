import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const adminSource = readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
const publicSource = readFileSync(path.join(root, "app/toonbti/page.tsx"), "utf8");
const routeMapSource = readFileSync(
  path.join(root, "components/admin/ToonbtiRouteMapBuilder.tsx"),
  "utf8"
);

describe("ToonBTI legacy cleanup", () => {
  it("removes the legacy DB manager, tag manager, and legacy API route", () => {
    expect(existsSync(path.join(root, "components/admin/ToonbtiManager.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "components/admin/ToonbtiTagManager.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "app/api/toonbti/route.ts"))).toBe(false);
    expect(adminSource).not.toContain("ToonbtiTagManager");
    expect(adminSource).not.toContain("episode_formats");
    expect(publicSource).not.toContain("episode_formats");
  });

  it("keeps the new question/result route-map editor and test runner", () => {
    expect(adminSource).toContain("ToonbtiRouteMapBuilder");
    expect(routeMapSource).toContain("ToonRouteDraft as RouteDraft");
    expect(routeMapSource).toContain("resultArtists");
    expect(routeMapSource).toContain("전체화면 편집");
    expect(routeMapSource).toContain("관리자 테스트");
    expect(routeMapSource).toContain('/api/admin/toon-tests');
    expect(routeMapSource).not.toContain("localStorage");
  });
});
