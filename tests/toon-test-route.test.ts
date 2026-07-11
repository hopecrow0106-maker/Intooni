import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminToonTest, saveAdminToonTest } from "@/lib/server/toon-tests";
import { GET, PUT } from "@/app/api/admin/toon-tests/route";

vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: vi.fn() }));
vi.mock("@/lib/server/toon-tests", () => ({
  getAdminToonTest: vi.fn(),
  saveAdminToonTest: vi.fn()
}));

describe("Admin ToonBTI route-map API", () => {
  beforeEach(() => {
    vi.mocked(isAdminAuthenticated).mockReset();
    vi.mocked(getAdminToonTest).mockReset();
    vi.mocked(saveAdminToonTest).mockReset();
  });

  it("rejects unauthenticated reads and writes", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    expect((await GET()).status).toBe(401);
    expect((await PUT(new Request("http://localhost", { method: "PUT" }))).status).toBe(401);
    expect(getAdminToonTest).not.toHaveBeenCalled();
    expect(saveAdminToonTest).not.toHaveBeenCalled();
  });

  it("saves an explicitly published normalized draft through the admin service", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    vi.mocked(saveAdminToonTest).mockResolvedValue({ id: "test-1", status: "published" } as never);
    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "툰비티아이", status: "published", draft: { nodes: [] } })
      })
    );
    expect(response.status).toBe(200);
    expect(saveAdminToonTest).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published", title: "툰비티아이" })
    );
  });
});
