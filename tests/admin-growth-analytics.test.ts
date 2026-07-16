import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildAdminGrowthAnalytics } from "@/lib/domain/admin-growth-analytics";

describe("admin growth analytics", () => {
  it("loads artist status without dropping hidden statistics at the query", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "app/api/admin/statistics/growth/route.ts"),
      "utf8"
    );

    expect(routeSource).toContain('.select("id, name, instagram_handle, status")');
    expect(routeSource).not.toContain('.eq("status", "active")');
  });

  it("keeps hidden statistics in totals but excludes hidden artists from rankings", () => {
    const analytics = buildAdminGrowthAnalytics(
      [
        { id: "active", name: "Active", instagram_handle: "active", status: "active" },
        { id: "hidden", name: "Hidden", instagram_handle: "hidden", status: "hidden" },
        { id: "archived", name: "Archived", instagram_handle: "archived", status: "archived" }
      ],
      [
        { artist_id: "active", recorded_date: "2026-07-01", followers: 100, post_count: 10 },
        { artist_id: "active", recorded_date: "2026-07-08", followers: 110, post_count: 11 },
        { artist_id: "hidden", recorded_date: "2026-07-01", followers: 200, post_count: 20 },
        { artist_id: "hidden", recorded_date: "2026-07-08", followers: 300, post_count: 30 },
        { artist_id: "archived", recorded_date: "2026-07-01", followers: 400, post_count: 40 },
        { artist_id: "archived", recorded_date: "2026-07-08", followers: 500, post_count: 50 }
      ]
    );

    expect(analytics.summary).toMatchObject({
      tracked_artists: 3,
      snapshot_count: 6,
      latest_total_followers: 910,
      followers_delta: 210
    });
    expect(analytics.timeline.at(-1)).toMatchObject({ tracked_artists: 3 });
    expect(analytics.top_followers.map((item) => item.artist_id)).toEqual(["active"]);
    expect(analytics.top_posts.map((item) => item.artist_id)).toEqual(["active"]);
  });

  it("builds continuous timeline and latest comparison rankings", () => {
    const analytics = buildAdminGrowthAnalytics(
      [
        { id: "a", name: "A", instagram_handle: "a" },
        { id: "b", name: "B", instagram_handle: "b" }
      ],
      [
        { artist_id: "a", recorded_date: "2026-07-01", followers: 100, post_count: 10 },
        { artist_id: "b", recorded_date: "2026-07-01", followers: 200, post_count: 20 },
        { artist_id: "a", recorded_date: "2026-07-08", followers: 120, post_count: 12 },
        { artist_id: "b", recorded_date: "2026-07-08", followers: 190, post_count: 21 }
      ]
    );

    expect(analytics.summary).toMatchObject({
      tracked_artists: 2,
      snapshot_count: 4,
      latest_total_followers: 310,
      followers_delta: 10,
      comparable_artists: 2
    });
    expect(analytics.timeline).toHaveLength(2);
    expect(analytics.timeline[1]).toMatchObject({ followers_delta: 10, posts_delta: 3 });
    expect(analytics.top_followers[0]).toMatchObject({ artist_id: "a", followers_delta: 20, interval_days: 7 });
    expect(analytics.follower_declines[0]).toMatchObject({ artist_id: "b", followers_delta: -10 });
  });
});
