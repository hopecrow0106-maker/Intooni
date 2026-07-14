import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("public canonical metadata", () => {
  it("declares self-referencing canonicals for the home and magazine list pages", () => {
    const homeSource = readSource("app/page.tsx");
    const magazineSource = readSource("app/magazine/page.tsx");

    expect(homeSource).toContain("canonical: CANONICAL_SITE_URL");
    expect(magazineSource).toContain("canonical: magazineUrl");
    expect(magazineSource).toContain("인투니 매거진");
  });

  it("does not claim that static sitemap routes changed on every request", () => {
    const sitemapSource = readSource("app/sitemap.ts");
    const staticRoutesSource = sitemapSource.slice(
      sitemapSource.indexOf("const staticRoutes"),
      sitemapSource.indexOf("try {")
    );

    expect(staticRoutesSource).not.toContain("lastModified");
  });

  it("keeps every public artist in the server-rendered fallback link list", () => {
    const homeSource = readSource("app/page.tsx");

    expect(homeSource).toContain("{artists.map((artist) => (");
    expect(homeSource).not.toContain("artists.slice(0, 100)");
  });
});
