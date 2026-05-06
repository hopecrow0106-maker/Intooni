"use client";

import { useMemo, useState } from "react";

import type { ArtistFormValues } from "@/components/admin/ArtistForm";

type ImportStatus = "idle" | "loading" | "success" | "partial" | "error";

type InstagramImportProfile = {
  username?: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount?: number;
  postsCount?: number;
};

type InstagramImportResponse = {
  ok?: boolean;
  status?: "success" | "partial";
  message?: string;
  profile?: InstagramImportProfile;
  posts?: Array<{ url: string; sortOrder: number }>;
  warnings?: string[];
};

type InstagramQuickImportProps = {
  onApply: (values: Partial<ArtistFormValues>) => void;
};

function splitLinks(value: string) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function guessProfileUrl(links: string[]) {
  return links.find((link) => {
    const normalized = link.toLowerCase();
    return (
      normalized.startsWith("@") ||
      (/instagram\.com\//.test(normalized) &&
        !/instagram\.com\/(p|reel|tv)\//.test(normalized))
    );
  });
}

function guessPostUrls(links: string[]) {
  return links
    .filter((link) => /instagram\.com\/(p|reel|tv)\//i.test(link))
    .slice(0, 4);
}

export function InstagramQuickImport({ onApply }: InstagramQuickImportProps) {
  const [bulkText, setBulkText] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [postUrls, setPostUrls] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [message, setMessage] = useState("");

  const detectedLinks = useMemo(() => splitLinks(bulkText), [bulkText]);

  const applyBulkLinks = (value: string) => {
    setBulkText(value);

    const links = splitLinks(value);
    const nextProfileUrl = guessProfileUrl(links);
    const nextPostUrls = guessPostUrls(links);

    if (nextProfileUrl) {
      setProfileUrl(nextProfileUrl);
    }

    if (nextPostUrls.length > 0) {
      setPostUrls([...nextPostUrls, "", "", "", ""].slice(0, 4));
    }
  };

  const importInstagram = async () => {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/admin/instagram/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileUrl,
          postUrls: postUrls.map((url) => url.trim()).filter(Boolean)
        })
      });

      const data = (await response.json()) as InstagramImportResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "인스타 정보를 불러오지 못했습니다.");
      }

      const profile = data.profile ?? {};
      const normalizedPostUrls = (data.posts ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((post) => post.url)
        .slice(0, 4);

      onApply({
        instagram_handle: profile.username ?? "",
        name: profile.displayName || profile.username || "",
        bio: profile.bio ?? "",
        memo: profile.bio ?? "",
        thumbnail_url: profile.profileImageUrl ?? "",
        followers: profile.followersCount ?? 0,
        post_count: profile.postsCount ?? 0,
        gallery_post_urls: [...normalizedPostUrls, "", "", "", ""].slice(0, 4)
      });

      setProfileUrl(profile.username ? `https://www.instagram.com/${profile.username}/` : profileUrl);
      setPostUrls([...normalizedPostUrls, "", "", "", ""].slice(0, 4));
      setStatus(data.status === "success" ? "success" : "partial");
      setMessage(
        data.message ??
          (data.status === "success"
            ? "인스타 정보를 불러왔습니다. 저장 전 내용을 확인해 주세요."
            : "게시물 링크는 입력했지만, 프로필 정보를 일부 가져오지 못했습니다.")
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "인스타 정보를 불러오지 못했습니다. 링크를 확인하거나 직접 입력해 주세요."
      );
    }
  };

  return (
    <section className="rounded-[24px] border border-[#ffd6df] bg-[#fff8fa] p-4 shadow-[0_14px_34px_rgba(255,77,109,0.08)]">
      <div className="space-y-1">
        <p className="text-sm font-bold text-coral">인스타 빠른 추가</p>
        <p className="text-xs leading-5 text-slate-500">
          프로필 링크와 대표 게시물 링크 4개를 붙여넣으면 기존 작가 폼에 가능한 값만 채워요.
          저장은 아래 저장 버튼을 눌렀을 때만 됩니다.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <label className="space-y-2">
          <span className="text-xs font-semibold text-slate-500">링크 5개 한 번에 붙여넣기</span>
          <textarea
            value={bulkText}
            onChange={(event) => applyBulkLinks(event.target.value)}
            placeholder={`https://www.instagram.com/example_artist/\nhttps://www.instagram.com/p/AAAA/\nhttps://www.instagram.com/p/BBBB/\nhttps://www.instagram.com/p/CCCC/\nhttps://www.instagram.com/p/DDDD/`}
            rows={5}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-coral"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold text-slate-500">인스타 프로필 링크</span>
          <input
            value={profileUrl}
            onChange={(event) => setProfileUrl(event.target.value)}
            placeholder="https://www.instagram.com/example_artist/"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-coral"
          />
        </label>

        <div className="grid gap-2 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <input
              key={index}
              value={postUrls[index]}
              onChange={(event) =>
                setPostUrls((current) => {
                  const next = [...current];
                  next[index] = event.target.value;
                  return next;
                })
              }
              placeholder={`대표 게시물 링크 ${index + 1}`}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-coral"
            />
          ))}
        </div>

        {detectedLinks.length > 0 ? (
          <p className="text-xs text-slate-400">
            감지된 링크 {detectedLinks.length}개 · 프로필/게시물 링크를 자동 분리했어요.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void importInstagram()}
          disabled={status === "loading"}
          className="w-full rounded-full bg-coral px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,77,109,0.22)] transition hover:bg-[#e83a5a] disabled:cursor-wait disabled:opacity-70"
        >
          {status === "loading" ? "불러오는 중..." : "인스타 정보 불러오기"}
        </button>

        {message ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              status === "error"
                ? "border border-red-200 bg-red-50 text-red-700"
                : status === "partial"
                  ? "border border-amber-200 bg-amber-50 text-amber-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
