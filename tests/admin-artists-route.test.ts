import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { sanitizeArtistPayload } from "@/lib/domain/admin-artist";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { DELETE, POST } from "@/app/api/artists/route";

vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("Admin artist write boundary", () => {
  beforeEach(() => {
    vi.mocked(isAdminAuthenticated).mockReset();
    vi.mocked(getSupabaseAdminClient).mockReset();
    vi.mocked(revalidatePath).mockReset();
  });

  it("rejects unauthenticated writes before reading the request body", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const response = await POST(new Request("http://localhost/api/artists", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("whitelists target artist fields and ignores legacy statistics", () => {
    const payload = sanitizeArtistPayload({
      name: " 작가 ",
      instagram_handle: "@Artist",
      main_category_id: "category-1",
      search_tags: [" 썰툰 ", "썰툰"],
      show_on_site: true,
      show_growth_on_site: false,
      status: "active",
      followers: 999,
      post_count: 99,
      weekly_follower_growth: 123,
      is_ad: true,
      is_hot: true,
      memo: "legacy"
    });

    expect(payload).toMatchObject({
      name: "작가",
      instagram_handle: "artist",
      main_category_id: "category-1",
      search_tags: ["썰툰"],
      show_growth_on_site: false,
      status: "active"
    });
    expect(payload).not.toHaveProperty("followers");
    expect(payload).not.toHaveProperty("post_count");
    expect(payload).not.toHaveProperty("weekly_follower_growth");
    expect(payload).not.toHaveProperty("is_ad");
    expect(payload).not.toHaveProperty("is_hot");
    expect(payload).not.toHaveProperty("memo");
  });

  it("rejects invalid image and gallery URLs before a database write", () => {
    const base = {
      name: "작가",
      instagram_handle: "artist",
      main_category_id: "category-1"
    };
    expect(() => sanitizeArtistPayload({ ...base, thumbnail_url: "javascript:alert(1)" })).toThrow(
      "thumbnail_url"
    );
    expect(() =>
      sanitizeArtistPayload({ ...base, gallery_post_urls: ["https://example.com/not-instagram"] })
    ).toThrow("gallery_post_urls");
    expect(
      sanitizeArtistPayload({
        ...base,
        gallery_post_urls: ["https://www.instagram.com/reel/example/"]
      }).gallery_post_urls
    ).toEqual(["https://www.instagram.com/reel/example/"]);
  });

  it("keeps public visibility and management status consistent", () => {
    expect(sanitizeArtistPayload({ id: "artist-1", show_on_site: true }, true)).toMatchObject({
      show_on_site: true,
      status: "active"
    });
    expect(sanitizeArtistPayload({ id: "artist-1", show_on_site: false }, true)).toMatchObject({
      show_on_site: false,
      status: "hidden"
    });
    expect(sanitizeArtistPayload({ id: "artist-1", status: "archived" }, true)).toMatchObject({
      show_on_site: false,
      status: "archived"
    });
  });

  it("keeps legacy statistics out of the direct artist edit form", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components/admin/ArtistForm.tsx"),
      "utf8"
    );
    expect(source).not.toContain("form.followers");
    expect(source).not.toContain("form.post_count");
    expect(source).not.toContain("weekly_follower_growth");
    expect(source).not.toContain("last_stats_updated_at");
    expect(source).toContain("main_category_id");
    expect(source).toContain("search_tags");
    expect(source).toContain("internal_memo");
  });

  it("archives normal removals instead of deleting artist history", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const deleteCall = vi.fn();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update, delete: deleteCall }))
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/artists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "artist-1" })
      })
    );
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "archived",
        show_on_site: false,
        show_growth_on_site: false,
        hide_from_new: true
      })
    );
    expect(deleteCall).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });
});
