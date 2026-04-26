"use client";

import type { PropsWithChildren, MouseEventHandler } from "react";

import type { ArtistEventType } from "@/lib/artist-events";

type TrackedArtistActionLinkProps = PropsWithChildren<{
  artistId: string;
  eventType: ArtistEventType;
  href: string;
  className?: string;
  target?: string;
  rel?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}>;

function trackArtistEvent(artistId: string, eventType: ArtistEventType) {
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
  onClick,
  children
}: TrackedArtistActionLinkProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
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

