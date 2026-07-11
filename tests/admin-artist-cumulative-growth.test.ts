import { describe, expect, it } from "vitest";

import {
  calculateCumulativeStatGrowth,
  type AdminArtistStat
} from "@/lib/domain/admin-artist-details";

function stat(recordedDate: string, followers: number, postCount: number): AdminArtistStat {
  return {
    id: recordedDate,
    artist_id: "artist-1",
    recorded_date: recordedDate,
    followers,
    post_count: postCount,
    created_at: `${recordedDate}T00:00:00.000Z`,
    updated_at: `${recordedDate}T00:00:00.000Z`
  };
}

describe("Admin cumulative stat growth", () => {
  it("compares the earliest and latest records regardless of collection interval", () => {
    const result = calculateCumulativeStatGrowth([
      stat("2026-07-11", 150, 18),
      stat("2026-07-03", 130, 16),
      stat("2026-04-01", 100, 10)
    ]);

    expect(result).toMatchObject({
      record_count: 3,
      first_recorded_date: "2026-04-01",
      latest_recorded_date: "2026-07-11",
      interval_days: 101,
      followers_delta: 50,
      posts_delta: 8,
      followers_growth_rate: 0.5,
      posts_growth_rate: 0.8
    });
  });

  it("keeps a single record as a valid starting point", () => {
    expect(calculateCumulativeStatGrowth([stat("2026-07-11", 100, 10)])).toMatchObject({
      record_count: 1,
      interval_days: 0,
      followers_delta: 0,
      posts_delta: 0
    });
  });

  it("returns null only when no records exist", () => {
    expect(calculateCumulativeStatGrowth([])).toBeNull();
  });
});
