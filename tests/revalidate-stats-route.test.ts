import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { revalidatePath } from "next/cache";
import { POST } from "@/app/api/internal/revalidate-stats/route";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

const originalSecret = process.env.COLLECTOR_REVALIDATE_SECRET;

describe("collector stats revalidation route", () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockReset();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.COLLECTOR_REVALIDATE_SECRET;
    } else {
      process.env.COLLECTOR_REVALIDATE_SECRET = originalSecret;
    }
  });

  it("does not revalidate when the collector secret is not configured", async () => {
    delete process.env.COLLECTOR_REVALIDATE_SECRET;

    const response = await POST(new Request("https://intooni.com/api/internal/revalidate-stats", {
      method: "POST"
    }));

    expect(response.status).toBe(500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated collector calls without revalidating public paths", async () => {
    process.env.COLLECTOR_REVALIDATE_SECRET = "expected-secret";

    const response = await POST(new Request("https://intooni.com/api/internal/revalidate-stats", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-secret"
      }
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Unauthorized" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates home, sitemap, and sanitized artist paths with a valid collector secret", async () => {
    process.env.COLLECTOR_REVALIDATE_SECRET = "expected-secret";

    const response = await POST(new Request("https://intooni.com/api/internal/revalidate-stats", {
      method: "POST",
      headers: {
        authorization: "Bearer expected-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        handles: ["@public_handle", " second_handle ", "@public_handle", ""]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      revalidated: {
        home: true,
        sitemap: true,
        artists: 2
      }
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(revalidatePath).toHaveBeenCalledWith("/artists/public_handle");
    expect(revalidatePath).toHaveBeenCalledWith("/artists/second_handle");
  });
});
