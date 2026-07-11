import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, POST } from "@/app/api/categories/route";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabasePublicServerClient: vi.fn()
}));

function request(method: string, body: unknown) {
  return new Request("http://localhost/api/categories", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("category Admin route", () => {
  beforeEach(() => {
    vi.mocked(isAdminAuthenticated).mockReset();
    vi.mocked(getSupabaseAdminClient).mockReset();
  });

  it("normalizes category names to NFC before inserting", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const single = vi.fn().mockResolvedValue({ data: { id: "category-1" }, error: null });
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
            }))
          }))
        })),
        insert
      }))
    } as never);

    const response = await POST(request("POST", { name: `  ${"일상".normalize("NFD")}  ` }));
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ name: "일상", sort_order: 0 });
  });

  it("returns 409 instead of deleting a category connected to artists", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const deleteCall = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "categories") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { name: "일상" }, error: null })
            }))
          })),
          delete: deleteCall
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null, count: 2 })
        }))
      };
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    const response = await DELETE(request("DELETE", { id: "category-1" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "연결된 작가가 있어 카테고리를 삭제할 수 없습니다."
    });
    expect(deleteCall).not.toHaveBeenCalled();
  });
});
