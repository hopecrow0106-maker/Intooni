import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getDetails } from "@/app/api/admin/artists/[id]/details/route";
import { POST as saveStat, DELETE as deleteStat } from "@/app/api/admin/artists/[id]/stats/route";
import { PUT as saveContact } from "@/app/api/admin/artists/[id]/contact/route";
import {
  POST as saveCollaboration,
  DELETE as deleteCollaboration
} from "@/app/api/admin/artists/[id]/collaborations/route";
import { PUT as saveB2b } from "@/app/api/admin/artists/[id]/b2b/route";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdminClient: vi.fn() }));

const context = { params: { id: "11111111-1111-4111-8111-111111111111" } };

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/artists/artist-1/details", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("Admin artist internal routes", () => {
  beforeEach(() => {
    vi.mocked(isAdminAuthenticated).mockReset();
    vi.mocked(getSupabaseAdminClient).mockReset();
  });

  it("requires signed Admin authentication on every internal route", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const responses = await Promise.all([
      getDetails(new Request("http://localhost"), context),
      saveStat(jsonRequest("POST", {}), context),
      deleteStat(jsonRequest("DELETE", {}), context),
      saveContact(jsonRequest("PUT", {}), context),
      saveCollaboration(jsonRequest("POST", {}), context),
      deleteCollaboration(jsonRequest("DELETE", {}), context),
      saveB2b(jsonRequest("PUT", {}), context)
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects invalid and negative official stats before touching Supabase", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const invalidDate = await saveStat(
      jsonRequest("POST", { recorded_date: "07/11/2026", followers: 10, post_count: 2 }),
      context
    );
    const negative = await saveStat(
      jsonRequest("POST", { recorded_date: "2026-07-11", followers: -1, post_count: 2 }),
      context
    );
    const impossibleDate = await saveStat(
      jsonRequest("POST", { recorded_date: "2026-02-31", followers: 10, post_count: 2 }),
      context
    );
    expect(invalidDate.status).toBe(400);
    expect(negative.status).toBe(400);
    expect(impossibleDate.status).toBe(400);
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("upserts same-day stats by artist_id and recorded_date", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const single = vi.fn().mockResolvedValue({ data: { id: "stat-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ upsert }))
    } as never);

    const response = await saveStat(
      jsonRequest("POST", { recorded_date: "2026-07-11", followers: 100, post_count: 20 }),
      context
    );
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        artist_id: context.params.id,
        recorded_date: "2026-07-11",
        followers: 100,
        post_count: 20
      }),
      { onConflict: "artist_id,recorded_date" }
    );
  });

  it("rejects invalid email, collaboration URL, and B2B grade", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const contact = await saveContact(jsonRequest("PUT", { email: "not-an-email" }), context);
    const collaboration = await saveCollaboration(
      jsonRequest("POST", {
        brand_name: "Brand",
        collaboration_year: 2026,
        collaboration_month: null,
        post_url: "https://example.com/post",
        ad_disclosure_status: "unknown"
      }),
      context
    );
    const b2b = await saveB2b(
      jsonRequest("PUT", { brand_safety_grade: "danger", brand_category_ids: [] }),
      context
    );
    expect(contact.status).toBe(400);
    expect(collaboration.status).toBe(400);
    expect(b2b.status).toBe(400);
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("stores the simplified collaboration fields and derives legacy date columns", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const single = vi.fn().mockResolvedValue({ data: { id: "collaboration-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    let insertedPayload: unknown;
    const insert = vi.fn((payload: unknown) => {
      insertedPayload = payload;
      return { select };
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ insert }))
    } as never);

    const response = await saveCollaboration(
      jsonRequest("POST", {
        brand_name: "브랜드",
        brand_industry: "식품",
        collaboration_date: "26.07.01",
        post_url: "https://www.instagram.com/p/example/",
        content_summary: "신제품 출시 릴스와 할인 코드 소개",
        likes: 10,
        comments: 2
      }),
      context
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        artist_id: context.params.id,
        brand_name: "브랜드",
        brand_industry: "식품",
        collaboration_date: "26.07.01",
        collaboration_year: 2026,
        collaboration_month: 7,
        post_url: "https://www.instagram.com/p/example/",
        content_summary: "신제품 출시 릴스와 할인 코드 소개",
        likes: 10,
        comments: 2
      })
    );
    const payload = insertedPayload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("views");
    expect(payload).not.toHaveProperty("ad_disclosure_status");
  });

  it("saves B2B profile and category links through one atomic RPC", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(true);
    const rpc = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: [{ id: "category-1" }], error: null })
        }))
      })),
      rpc
    } as never);

    const response = await saveB2b(
      jsonRequest("PUT", {
        strengths: "강점",
        cautions: "주의",
        brand_safety_grade: "safe",
        brand_category_ids: ["category-1", "category-1"]
      }),
      context
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("admin_replace_artist_b2b_profile", {
      p_artist_id: context.params.id,
      p_strengths: "강점",
      p_cautions: "주의",
      p_brand_safety_grade: "safe",
      p_brand_category_ids: ["category-1"]
    });
  });
});
