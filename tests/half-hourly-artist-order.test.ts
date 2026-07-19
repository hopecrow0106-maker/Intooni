import { describe, expect, it } from "vitest";

import {
  createHalfHourlyOrderMap,
  millisecondsUntilNextHalfHour,
  orderArtistsForHalfHour
} from "@/lib/half-hourly-artist-order";

const artists = [
  { id: "artist-c" },
  { id: "artist-a" },
  { id: "artist-b" },
  { id: "artist-d" }
];

describe("half-hourly artist ordering", () => {
  it("keeps the same order throughout one half-hour window", () => {
    const before = orderArtistsForHalfHour(artists, new Date("2026-07-19T12:01:00+09:00").getTime());
    const after = orderArtistsForHalfHour(artists, new Date("2026-07-19T12:29:59+09:00").getTime());

    expect(after.map((artist) => artist.id)).toEqual(before.map((artist) => artist.id));
  });

  it("uses a new deterministic order after the half-hour boundary", () => {
    const before = createHalfHourlyOrderMap(
      artists,
      new Date("2026-07-19T12:29:59+09:00").getTime()
    );
    const after = createHalfHourlyOrderMap(
      artists,
      new Date("2026-07-19T12:30:00+09:00").getTime()
    );

    expect(after).not.toEqual(before);
    expect(createHalfHourlyOrderMap(artists, new Date("2026-07-19T12:45:00+09:00").getTime())).toEqual(
      after
    );
  });

  it("schedules the next :00 or :30 boundary", () => {
    expect(millisecondsUntilNextHalfHour(new Date("2026-07-19T12:12:00+09:00").getTime())).toBe(
      18 * 60 * 1000
    );
    expect(millisecondsUntilNextHalfHour(new Date("2026-07-19T12:30:00+09:00").getTime())).toBe(
      30 * 60 * 1000
    );
  });
});
