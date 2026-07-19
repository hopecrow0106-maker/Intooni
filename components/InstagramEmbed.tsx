"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
  }
}

type InstagramEmbedProps = {
  url: string;
  className?: string;
  compact?: boolean;
  lazy?: boolean;
};

let instagramProcessTimer: number | null = null;

function scheduleInstagramProcess() {
  if (typeof window === "undefined") {
    return;
  }

  if (instagramProcessTimer !== null) {
    window.clearTimeout(instagramProcessTimer);
  }

  instagramProcessTimer = window.setTimeout(() => {
    instagramProcessTimer = null;
    window.instgrm?.Embeds?.process();
  }, 120);
}

function normalizeInstagramUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (!parsed.hostname.includes("instagram.com")) {
      return trimmed;
    }

    parsed.search = "";
    parsed.hash = "";

    let pathname = parsed.pathname.trim();
    if (!pathname.endsWith("/")) {
      pathname += "/";
    }

    pathname = pathname.replace(/embed\/?$/i, "");
    parsed.pathname = pathname.endsWith("/") ? pathname : `${pathname}/`;

    return parsed.toString();
  } catch {
    return trimmed.replace(/embed\/?$/i, "").trim();
  }
}

function ensureInstagramScript(onReady?: () => void) {
  if (typeof window === "undefined") {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-instagram-embed="true"]'
  );

  if (existingScript) {
    if (window.instgrm?.Embeds?.process) {
      onReady?.();
    } else if (onReady) {
      existingScript.addEventListener("load", onReady, { once: true });
    }
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.instagram.com/embed.js";
  script.setAttribute("data-instagram-embed", "true");

  if (onReady) {
    script.addEventListener("load", onReady, { once: true });
  }

  document.body.appendChild(script);
}

export function InstagramEmbed({
  url,
  className = "",
  compact = false,
  lazy = false
}: InstagramEmbedProps) {
  const embedRef = useRef<HTMLDivElement | null>(null);
  const normalizedUrl = useMemo(() => normalizeInstagramUrl(url), [url]);
  const [shouldRender, setShouldRender] = useState(!lazy);

  useEffect(() => {
    if (!lazy || shouldRender || !embedRef.current) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(embedRef.current);
    return () => observer.disconnect();
  }, [lazy, shouldRender]);

  useEffect(() => {
    if (!normalizedUrl || !shouldRender || !embedRef.current) {
      return;
    }

    ensureInstagramScript(scheduleInstagramProcess);
    scheduleInstagramProcess();
  }, [normalizedUrl, shouldRender]);

  if (!normalizedUrl) {
    return null;
  }

  if (!shouldRender) {
    return (
      <div
        ref={embedRef}
        className={`flex min-h-[520px] min-w-0 max-w-full items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 ${className}`}
      >
        <span className="text-sm font-medium text-slate-400">게시물을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div
      ref={embedRef}
      className={`min-w-0 max-w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white ${className}`}
    >
      <blockquote
        className="instagram-media !m-0 !min-w-0 !max-w-none"
        data-instgrm-permalink={normalizedUrl}
        data-instgrm-version="14"
        style={{
          background: "#ffffff",
          border: 0,
          margin: 0,
          width: "100%",
          minWidth: "100%"
        }}
      >
        <a href={normalizedUrl} target="_blank" rel="noreferrer">
          Instagram 게시물 보기
        </a>
      </blockquote>
      {compact && (
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          링크를 입력하면 실제 인스타 게시물 미리보기가 여기에 표시됩니다.
        </div>
      )}
    </div>
  );
}

