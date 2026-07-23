import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getAdminToonbtiData,
  saveAdminToonbtiConfig,
  saveArtistToonbtiAssignment
} from "@/lib/server/toonbti";
import { GET, PUT } from "@/app/api/admin/toonbti/route";
import { PUT as PUT_ASSIGNMENT } from "@/app/api/admin/toonbti/assignments/route";

vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: vi.fn() }));
vi.mock("@/lib/server/toonbti", () => ({
  getAdminToonbtiData: vi.fn(),
  saveAdminToonbtiConfig: vi.fn(),
  saveArtistToonbtiAssignment: vi.fn()
}));

describe("Toon-BTI admin API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated configuration reads and writes", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    expect((await GET()).status).toBe(401);
    expect(
      (
        await PUT(
          new Request("http://localhost/api/admin/toonbti", {
            method: "PUT",
            body: JSON.stringify({ config: {} })
          })
        )
      ).status
    ).toBe(401);
    expect(getAdminToonbtiData).not.toHaveBeenCalled();
    expect(saveAdminToonbtiConfig).not.toHaveBeenCalled();
  });

  it("returns and stores normalized configuration through the server boundary", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    vi.mocked(getAdminToonbtiData).mockResolvedValue({
      config: { test: { id: "test-1" } },
      assignments: []
    } as never);
    vi.mocked(saveAdminToonbtiConfig).mockResolvedValue({
      test: { id: "test-1" }
    } as never);

    const readResponse = await GET();
    expect(readResponse.status).toBe(200);
    expect(await readResponse.json()).toMatchObject({ storageAvailable: true });

    const config = { test: { id: "test-1" } };
    const writeResponse = await PUT(
      new Request("http://localhost/api/admin/toonbti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config })
      })
    );
    expect(writeResponse.status).toBe(200);
    expect(saveAdminToonbtiConfig).toHaveBeenCalledWith(config);
  });

  it("stores or clears an artist result assignment only for authenticated admins", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    vi.mocked(saveArtistToonbtiAssignment).mockResolvedValue({
      artistId: "artist-1",
      testId: "test-1",
      resultTypeId: "result-1"
    });
    const response = await PUT_ASSIGNMENT(
      new Request("http://localhost/api/admin/toonbti/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId: "artist-1",
          testId: "test-1",
          resultTypeId: "result-1"
        })
      })
    );
    expect(response.status).toBe(200);
    expect(saveArtistToonbtiAssignment).toHaveBeenCalledWith({
      artistId: "artist-1",
      testId: "test-1",
      resultTypeId: "result-1"
    });
  });
});
