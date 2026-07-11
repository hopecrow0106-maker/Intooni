import { describe, expect, it } from "vitest";

import { buildAdminGrowthAnalytics } from "@/lib/domain/admin-growth-analytics";

describe("admin growth analytics", () => {
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
