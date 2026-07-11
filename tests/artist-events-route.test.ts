import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/artist-events/route";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdminClient: vi.fn() }));

describe("artist event Admin aggregation", () => {
  beforeEach(() => {
    vi.mocked(isAdminAuthenticated).mockReset();
    vi.mocked(getSupabaseAdminClient).mockReset();
  });

  it("normalizes legacy rows into only artist_click and instagram_outbound", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const range = vi.fn().mockResolvedValue({
      data: [
        { artist_id: "artist-1", event_type: "profile_click" },
        { artist_id: "artist-1", event_type: "embed_click" },
        { artist_id: "artist-1", event_type: "instagram_click" }
      ],
      error: null
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({ range }))
        }))
      }))
    } as never);

    const response = await GET(new Request("http://localhost/api/artist-events?period=all"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.stats).toEqual([
      { artist_id: "artist-1", artist_click: 1, instagram_outbound: 2 }
    ]);
    expect(body.stats[0]).not.toHaveProperty("profile_click");
    expect(body.stats[0]).not.toHaveProperty("embed_click");
  });
});
