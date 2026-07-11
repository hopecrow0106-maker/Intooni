import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourceFiles = [
  "../app/page.tsx",
  "../app/magazine/page.tsx",
  "../app/magazine/[id]/page.tsx",
  "../app/api/magazines/route.ts",
  "../lib/server/public-magazines.ts"
];

describe("public magazine query boundary", () => {
  it("does not use wildcard magazine selects in public surfaces", () => {
    for (const sourceFile of sourceFiles) {
      const source = readFileSync(path.resolve(__dirname, sourceFile), "utf8");
      expect(source).not.toMatch(/\.select\(\s*["']\*["']\s*\)/);
    }
  });

  it("keeps publication controls and legacy artist ids out of the public list DTO", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../lib/domain/public-magazine.ts"),
      "utf8"
    );

    expect(source).not.toContain("is_public:");
    expect(source).not.toContain("related_artist_ids:");
    expect(source).toContain("PUBLIC_MAGAZINE_COLUMNS");
  });
});
