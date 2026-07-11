"use client";

import type { PropsWithChildren, MouseEventHandler } from "react";

import type { DisplayArtistEventType } from "@/lib/artist-events";

type TrackedArtistActionLinkProps = PropsWithChildren<{
  artistId: string;
  eventType: DisplayArtistEventType;
  href: string;
  className?: string;
  target?: string;
  rel?: string;
  title?: string;
  "aria-label"?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}>;

function trackArtistEvent(artistId: string, eventType: DisplayArtistEventType) {
  void fetch("/api/artist-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ artistId, eventType }),
    keepalive: true
  }).catch(() => undefined);
}

export function TrackedArtistActionLink({
  artistId,
  eventType,
  href,
  className,
  target = "_blank",
  rel = "noreferrer",
  title,
  "aria-label": ariaLabel,
  onClick,
  children
}: TrackedArtistActionLinkProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      title={title}
      aria-label={ariaLabel}
      className={className}
      onClick={(event) => {
        trackArtistEvent(artistId, eventType);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
