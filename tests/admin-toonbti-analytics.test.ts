import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildAdminToonbtiAnalytics } from "@/lib/domain/admin-toonbti-analytics";

const artists = [
  { id: "a", status: "active" as const },
  { id: "b", status: "hidden" as const },
  { id: "c", status: "archived" as const },
  { id: "d", status: "active" as const },
  { id: "e", status: "active" as const }
];

const resultTypes = [
  { id: "rf", code: "RLPM", name: "현실 유쾌형", position: 0, is_active: true },
  { id: "fd", code: "FDSH", name: "판타지 몰입형", position: 1, is_active: true },
  { id: "rp", code: "RDPM", name: "현실 몰입형", position: 2, is_active: true }
];

const axes = [
  { id: "axis-1", name: "소재", position: 0, is_active: true },
  { id: "axis-2", name: "감정", position: 1, is_active: true },
  { id: "axis-3", name: "전개", position: 2, is_active: true },
  { id: "axis-4", name: "강도", position: 3, is_active: true }
];

const traits = [
  { axis_id: "axis-1", code: "R", name: "현실형", position: 0, is_active: true },
  { axis_id: "axis-1", code: "F", name: "판타지형", position: 1, is_active: true },
  { axis_id: "axis-2", code: "L", name: "유쾌형", position: 0, is_active: true },
  { axis_id: "axis-2", code: "D", name: "몰입형", position: 1, is_active: true },
  { axis_id: "axis-3", code: "P", name: "포인트형", position: 0, is_active: true },
  { axis_id: "axis-3", code: "S", name: "스토리형", position: 1, is_active: true },
  { axis_id: "axis-4", code: "M", name: "순한맛형", position: 0, is_active: true },
  { axis_id: "axis-4", code: "H", name: "매운맛형", position: 1, is_active: true }
];

describe("admin Toon-BTI analytics", () => {
  it("counts every assigned artist and keeps status detail", () => {
    const analytics = buildAdminToonbtiAnalytics(
      artists,
      [
        { artist_id: "a", result_type_id: "rf" },
        { artist_id: "b", result_type_id: "rf" },
        { artist_id: "c", result_type_id: "fd" },
        { artist_id: "d", result_type_id: "rf" }
      ],
      resultTypes,
      axes,
      traits
    );

    expect(analytics.summary).toMatchObject({
      total_artists: 5,
      assigned_artists: 4,
      unassigned_artists: 1,
      assignment_rate: 80,
      most_common_code: "RLPM",
      most_common_count: 3
    });
    expect(analytics.assigned_artist_ids).toEqual(["a", "b", "c", "d"]);
    expect(analytics.types[0]).toMatchObject({
      code: "RLPM",
      count: 3,
      share: 75,
      active_count: 2,
      hidden_count: 1,
      archived_count: 0
    });
    expect(analytics.types[1]).toMatchObject({
      code: "FDSH",
      count: 1,
      archived_count: 1
    });
  });

  it("derives both sides of all four axes from result codes", () => {
    const analytics = buildAdminToonbtiAnalytics(
      artists,
      [
        { artist_id: "a", result_type_id: "rf" },
        { artist_id: "b", result_type_id: "rf" },
        { artist_id: "c", result_type_id: "fd" },
        { artist_id: "d", result_type_id: "rp" }
      ],
      resultTypes,
      axes,
      traits
    );

    expect(analytics.axes).toHaveLength(4);
    expect(analytics.axes[0]).toMatchObject({
      left: { code: "R", count: 3, share: 75 },
      right: { code: "F", count: 1, share: 25 }
    });
    expect(analytics.axes[1]).toMatchObject({
      left: { code: "L", count: 2, share: 50 },
      right: { code: "D", count: 2, share: 50 }
    });
    expect(analytics.axes[3]).toMatchObject({
      left: { code: "M", count: 3, share: 75 },
      right: { code: "H", count: 1, share: 25 }
    });
  });

  it("uses an authenticated admin-only statistics endpoint", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "app/api/admin/statistics/toonbti/route.ts"),
      "utf8"
    );

    expect(routeSource).toContain("isAdminAuthenticated()");
    expect(routeSource).toContain('from("artist_toonbti_types")');
    expect(routeSource).toContain('from("artists").select("id, status")');
  });
});
