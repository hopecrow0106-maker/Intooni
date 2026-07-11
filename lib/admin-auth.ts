import crypto from "node:crypto";

import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "instoon-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

type LoginAttemptEntry = {
  count: number;
  expiresAt: number;
};

const loginAttempts = new Map<string, LoginAttemptEntry>();

type AdminSessionPayload = {
  exp: number;
  iat: number;
  nonce: string;
  v: 1;
};

export function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("ADMIN_PASSWORD is missing. Add it to your .env.local file.");
  }

  return password;
}

export function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is missing. Add it to your environment variables.");
  }

  return secret;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return crypto
    .createHmac("sha256", getAdminSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionToken() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    v: 1,
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_MAX_AGE_SECONDS,
    nonce: crypto.randomBytes(16).toString("base64url")
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token?: string) {
  if (!token) {
    return false;
  }

  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminSessionPayload>;
    const now = Math.floor(Date.now() / 1000);

    return payload.v === 1 && typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

export function isAdminAuthenticated() {
  return verifyAdminSessionToken(cookies().get(ADMIN_COOKIE_NAME)?.value);
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
