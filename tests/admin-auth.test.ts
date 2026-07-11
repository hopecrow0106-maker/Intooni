import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminSessionToken
} from "@/lib/admin-auth";

describe("admin session token", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-with-enough-entropy";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.ADMIN_SESSION_SECRET;
  });

  it("accepts a signed unexpired token", () => {
    const token = createAdminSessionToken();

    expect(verifyAdminSessionToken(token)).toBe(true);
  });

  it("rejects a token with a tampered payload", () => {
    const token = createAdminSessionToken();
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ v: 1, iat: 1, exp: 9999999999 }))
      .toString("base64url");

    expect(verifyAdminSessionToken(`${tamperedPayload}.${signature}`)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = createAdminSessionToken();
    vi.setSystemTime(new Date((ADMIN_SESSION_MAX_AGE_SECONDS + 1) * 1000 + Date.now()));

    expect(verifyAdminSessionToken(token)).toBe(false);
  });
});
