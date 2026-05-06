import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";

type ImportRequest = {
  profileUrl?: string;
  postUrls?: string[];
};

type NormalizedPost = {
  url: string;
  sortOrder: number;
};

type ParsedProfile = {
  username: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount?: number;
  postsCount?: number;
};

const RESERVED_PROFILE_PATHS = new Set([
  "p",
  "reel",
  "tv",
  "explore",
  "accounts",
  "about",
  "developer",
  "privacy",
  "terms"
]);

function unauthorizedResponse() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function normalizeProfileUrl(rawValue?: string) {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error("인스타 프로필 링크를 입력해 주세요.");
  }

  const handle = value.startsWith("@") ? value.slice(1).trim() : "";
  if (handle) {
    return normalizeUsername(handle);
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("인스타 프로필 링크 형식을 확인해 주세요.");
  }

  if (!isInstagramHost(url.hostname)) {
    throw new Error("instagram.com 프로필 링크만 사용할 수 있어요.");
  }

  const username = decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] ?? "");
  return normalizeUsername(username);
}

function normalizeUsername(username: string) {
  const cleanUsername = username.replace(/^@/, "").trim();

  if (!/^[A-Za-z0-9._]{1,30}$/.test(cleanUsername)) {
    throw new Error("인스타 계정명을 확인해 주세요.");
  }

  if (RESERVED_PROFILE_PATHS.has(cleanUsername.toLowerCase())) {
    throw new Error("인스타 프로필 링크가 아닌 것 같아요.");
  }

  return {
    username: cleanUsername,
    url: `https://www.instagram.com/${cleanUsername}/`
  };
}

function normalizePostUrl(rawValue: string, sortOrder: number): NormalizedPost {
  const value = rawValue.trim();
  if (!value) {
    throw new Error(`대표 게시물 링크 ${sortOrder}번이 비어 있어요.`);
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`대표 게시물 링크 ${sortOrder}번 형식을 확인해 주세요.`);
  }

  if (!isInstagramHost(url.hostname)) {
    throw new Error(`대표 게시물 링크 ${sortOrder}번은 instagram.com 링크만 사용할 수 있어요.`);
  }

  const [type, shortcode] = url.pathname.split("/").filter(Boolean);
  if (!["p", "reel", "tv"].includes(type) || !shortcode) {
    throw new Error(`대표 게시물 링크 ${sortOrder}번은 게시물 또는 릴스 링크여야 해요.`);
  }

  const normalizedType = type === "tv" ? "p" : type;
  return {
    url: `https://www.instagram.com/${normalizedType}/${shortcode}/`,
    sortOrder
  };
}

function isInstagramHost(hostname: string) {
  const lowerHostname = hostname.toLowerCase();
  return lowerHostname === "instagram.com" || lowerHostname === "www.instagram.com";
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractMetaContent(html: string, property: string) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedProperty}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const reversedRegex = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapedProperty}["'][^>]*>`,
    "i"
  );

  return decodeHtmlEntities(regex.exec(html)?.[1] ?? reversedRegex.exec(html)?.[1] ?? "").trim();
}

function parseCompactNumber(rawValue?: string) {
  if (!rawValue) {
    return undefined;
  }

  const normalized = rawValue.replace(/,/g, "").trim().toLowerCase();
  const match = /^([\d.]+)\s*([kmb]|만)?/.exec(normalized);
  if (!match) {
    return undefined;
  }

  const base = Number(match[1]);
  if (!Number.isFinite(base)) {
    return undefined;
  }

  const unit = match[2];
  if (unit === "k") {
    return Math.round(base * 1_000);
  }
  if (unit === "m") {
    return Math.round(base * 1_000_000);
  }
  if (unit === "b") {
    return Math.round(base * 1_000_000_000);
  }
  if (unit === "만") {
    return Math.round(base * 10_000);
  }

  return Math.round(base);
}

function parseProfileFromHtml(html: string, fallbackUsername: string): ParsedProfile {
  const title = extractMetaContent(html, "og:title");
  const description = extractMetaContent(html, "og:description");
  const image = extractMetaContent(html, "og:image");

  const displayName =
    title
      .replace(/\(@.*?\)/, "")
      .replace(/Instagram.*$/i, "")
      .replace(/[•|-]\s*Instagram.*$/i, "")
      .trim() || undefined;

  const followerMatch =
    description.match(/([\d.,]+[kmbKMB]?)\s+Followers/i) ??
    description.match(/팔로워\s*([\d.,]+만?)/i);
  const postsMatch =
    description.match(/([\d.,]+[kmbKMB]?)\s+Posts/i) ??
    description.match(/게시물\s*([\d.,]+만?)/i);

  const bio =
    description
      .replace(/^.*?-\s*/, "")
      .replace(/^See Instagram photos and videos from\s+/i, "")
      .trim() || undefined;

  return {
    username: fallbackUsername,
    displayName,
    bio,
    profileImageUrl: image || undefined,
    followersCount: parseCompactNumber(followerMatch?.[1]),
    postsCount: parseCompactNumber(postsMatch?.[1])
  };
}

async function fetchInstagramProfile(username: string, profileUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(profileUrl, {
      signal: controller.signal,
      headers: {
        "accept-language": "en-US,en;q=0.9,ko;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("profile_fetch_failed");
    }

    const html = await response.text();
    const profile = parseProfileFromHtml(html, username);
    const hasUsefulProfileData =
      profile.displayName ||
      profile.bio ||
      profile.profileImageUrl ||
      profile.followersCount !== undefined ||
      profile.postsCount !== undefined;

    return {
      profile,
      ok: Boolean(hasUsefulProfileData)
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as ImportRequest;
    const normalizedProfile = normalizeProfileUrl(body.profileUrl);
    const normalizedPosts = (body.postUrls ?? [])
      .filter((url) => url.trim())
      .slice(0, 4)
      .map((url, index) => normalizePostUrl(url, index + 1));

    const warnings: string[] = [];
    let profile: ParsedProfile = { username: normalizedProfile.username };

    try {
      const result = await fetchInstagramProfile(normalizedProfile.username, normalizedProfile.url);
      profile = result.profile;

      if (!result.ok) {
        warnings.push("인스타 프로필 정보를 일부 가져오지 못했습니다.");
      }
    } catch {
      warnings.push("인스타 프로필 정보를 가져오지 못했습니다. 직접 확인해 주세요.");
    }

    if (normalizedPosts.length === 0) {
      warnings.push("대표 게시물 링크가 없습니다. 필요하면 직접 입력해 주세요.");
    }

    return NextResponse.json({
      ok: true,
      status: warnings.length > 0 ? "partial" : "success",
      message:
        warnings.length > 0
          ? "게시물 링크는 입력했지만, 프로필 정보를 일부 가져오지 못했습니다."
          : "인스타 정보를 불러왔습니다. 저장 전 내용을 확인해 주세요.",
      profile,
      posts: normalizedPosts,
      warnings
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "인스타 정보를 불러오지 못했습니다. 링크를 확인하거나 직접 입력해 주세요."
      },
      { status: 400 }
    );
  }
}
