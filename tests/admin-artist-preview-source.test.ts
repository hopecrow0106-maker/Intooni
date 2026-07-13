import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "components", "admin", "ArtistForm.tsx"),
  "utf8"
);

describe("admin artist public profile preview", () => {
  it("preserves bio line breaks and links to the Instagram profile", () => {
    expect(source).toContain("whitespace-pre-wrap break-keep");
    expect(source).toContain("Instagram 바로가기");
    expect(source).toContain("https://www.instagram.com/");
    expect(source).toContain('target="_blank"');
  });
});
