import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "instoon-admin-session";

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

type LoginAttemptEntry = {
  count: number;
  expiresAt: number;
};

const loginAttempts = new Map<string, LoginAttemptEntry>();

export function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("ADMIN_PASSWORD is missing. Add it to your .env.local file.");
  }

  return password;
}

export function isAdminAuthenticated() {
  return cookies().get(ADMIN_COOKIE_NAME)?.value === "authenticated";
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function checkLoginRateLimit(ip: string) {
  const now = Date.now();
  const existing = loginAttempts.get(ip);

  if (!existing || existing.expiresAt <= now) {
    loginAttempts.set(ip, {
      count: 0,
      expiresAt: now + LOGIN_WINDOW_MS
    });
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
  }

  if (existing.count >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.expiresAt - now
    };
  }

  return {
    allowed: true,
    remaining: MAX_LOGIN_ATTEMPTS - existing.count
  };
}

export function recordFailedLoginAttempt(ip: string) {
  const now = Date.now();
  const existing = loginAttempts.get(ip);

  if (!existing || existing.expiresAt <= now) {
    loginAttempts.set(ip, {
      count: 1,
      expiresAt: now + LOGIN_WINDOW_MS
    });
    return;
  }

  existing.count += 1;
  loginAttempts.set(ip, existing);
}

export function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}
