"use client";

import { useEffect, useRef } from "react";

import { ADSENSE_ENABLED } from "@/lib/adsense";

const ADSENSE_CLIENT = "ca-pub-8362832465607393";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type GoogleAdProps = {
  slot: string;
  label: string;
  className?: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  fullWidthResponsive?: boolean;
};

export function GoogleAd({
  slot,
  label,
  className = "",
  format = "auto",
  fullWidthResponsive = true
}: GoogleAdProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!ADSENSE_ENABLED) {
      return;
    }

    const element = adRef.current;
    if (!element || requestedRef.current) {
      return;
    }

    // React Strict Mode can run effects twice in development. AdSense throws if an
    // already-filled <ins> receives another push, so guard both locally and via its status.
    if (element.getAttribute("data-adsbygoogle-status")) {
      requestedRef.current = true;
      return;
    }

    requestedRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      try {
        window.adsbygoogle = window.adsbygoogle ?? [];
        window.adsbygoogle.push({});
      } catch {
        // Ad blockers or delayed AdSense script loading can throw; keep the page usable.
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [slot]);

  if (!ADSENSE_ENABLED) {
    return null;
  }

  return (
    <div
      aria-label={label}
      className={`overflow-hidden rounded-[20px] bg-slate-50/70 ${className}`}
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  );
}
