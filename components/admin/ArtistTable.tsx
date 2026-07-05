"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult
} from "@hello-pangea/dnd";

import {
  EMPTY_ARTIST_STATS,
  type ArtistStatsPeriod,
  type ArtistStatsSummary
} from "@/lib/artist-events";
import { ARTIST_SQUARE_PLACEHOLDER } from "@/lib/placeholders";
import type { Artist } from "@/lib/types";

type ArtistTableProps = {
  artists: Artist[];
  statsByArtistId: Record<string, ArtistStatsSummary>;
  statsPeriod: ArtistStatsPeriod;
  onEdit: (artist: Artist) => void;
  onDelete: (artist: Artist) => void;
  onToggleAd: (artist: Artist) => void;
  onToggleHot: (artist: Artist) => void;
  onReorder: (artists: Artist[]) => void;
  isSaving: boolean;
  reorderEnabled?: boolean;
};

const STALE_DAYS = 14;

function reorderList(items: Artist[], startIndex: number, endIndex: number) {
  const nextItems = [...items];
  const [removed] = nextItems.splice(startIndex, 1);
  nextItems.splice(endIndex, 0, removed);
  return nextItems.map((artist, index) => ({
    ...artist,
    sort_order: index
  }));
}

function formatUpdatedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function isStale(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return Date.now() - date.getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function isToonbtiDataMissing(artist: Artist) {
  return (
    artist.mood_tags.length === 0 ||
    artist.episode_formats.length === 0 ||
    artist.style_tags.length === 0 ||
    artist.topic_tags.length === 0
  );
}

function isHiddenTagsMissing(artist: Artist) {
  return artist.hidden_tags.map((tag) => tag.trim()).filter(Boolean).length === 0;
}

function isCharacterImageMissing(artist: Artist) {
  return artist.character_url.trim().length === 0;
}

function getPeriodLabel(period: ArtistStatsPeriod) {
  switch (period) {
    case "day":
      return "오늘";
    case "week":
      return "7일";
    case "year":
      return "1년";
    case "all":
    default:
      return "전체";
  }
}

function getStatsTotal(stats: ArtistStatsSummary) {
  return (
    stats.profile_click +
    stats.instagram_click +
    stats.embed_click +
    stats.hero_click +
    stats.toonbti_result_click +
    stats.toonbti_character_click +
    stats.random_click
  );
}

function ToggleRow({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <button
        type="button"
        onClick={onClick}
        className={`switch-track ${active ? "bg-slate-900" : "bg-slate-300"}`}
      >
        <span className={`switch-thumb ${active ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export function ArtistTable({
  artists,
  statsByArtistId,
  statsPeriod,
  onEdit,
  onDelete,
  onToggleAd,
  onToggleHot,
  onReorder,
  isSaving,
  reorderEnabled = true
}: ArtistTableProps) {
  const [localArtists, setLocalArtists] = useState(artists);

  useEffect(() => {
    setLocalArtists(artists);
  }, [artists]);

  const openInstagramProfile = (handle: string) => {
    const normalizedHandle = handle.replace(/^@/, "").trim();
    if (!normalizedHandle) {
      return;
    }

    window.open(`https://www.instagram.com/${normalizedHandle}/`, "_blank", "noopener,noreferrer");
  };

  const handleDragEnd = (result: DropResult) => {
    if (!reorderEnabled) {
      return;
    }

    if (!result.destination) {
      return;
    }

    const nextArtists = reorderList(localArtists, result.source.index, result.destination.index);
    setLocalArtists(nextArtists);
    onReorder(nextArtists);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="artist-table">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
            {localArtists.map((artist, index) => {
              const stats = statsByArtistId[artist.id] ?? {
                artist_id: artist.id,
                ...EMPTY_ARTIST_STATS
              };
              const statsTotal = getStatsTotal(stats);

              return (
                <Draggable
                  key={artist.id}
                  draggableId={artist.id}
                  index={index}
                  isDragDisabled={!reorderEnabled}
                >
                  {(dragProvided) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          {...dragProvided.dragHandleProps}
                          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ${
                            reorderEnabled ? "cursor-grab active:cursor-grabbing" : ""
                          }`}
                          title={reorderEnabled ? "드래그해서 순서 변경" : "최신순 페이지 목록"}
                        >
                          <Image
                            src={artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER}
                            alt={artist.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="font-semibold text-ink">{artist.name}</p>
                            <p className="text-sm text-slate-500">
                              {artist.genre} · @{artist.instagram_handle}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-500">
                              통계 업데이트 {formatUpdatedDate(artist.last_stats_updated_at)}
                            </span>
                            {isStale(artist.last_stats_updated_at) ? (
                              <span className="rounded-md bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                                업데이트 필요
                              </span>
                            ) : null}
                            {artist.hide_from_new ? (
                              <span className="rounded-md bg-slate-200 px-2.5 py-1 font-semibold text-slate-600">
                                NEW 제외
                              </span>
                            ) : null}
                            {isToonbtiDataMissing(artist) ? (
                              <span className="rounded-md bg-red-100 px-2.5 py-1 font-semibold text-red-600">
                                툰비티아이 데이터 누락!
                              </span>
                            ) : null}
                            {isHiddenTagsMissing(artist) ? (
                              <span className="rounded-md bg-orange-100 px-2.5 py-1 font-semibold text-orange-700">
                                숨김태그 누락!
                              </span>
                            ) : null}
                            {isCharacterImageMissing(artist) ? (
                              <span className="rounded-md bg-sky-100 px-2.5 py-1 font-semibold text-sky-700">
                                누끼 PNG 누락!
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                              {getPeriodLabel(statsPeriod)} 총 반응 {statsTotal}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-500">
                              상세 통계는 수정/정보에서 확인
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <ToggleRow label="광고" active={artist.is_ad} onClick={() => onToggleAd(artist)} />
                        <ToggleRow
                          label="요즘 뜨는 작가"
                          active={artist.is_hot}
                          onClick={() => onToggleHot(artist)}
                        />
                        <button
                          type="button"
                          onClick={() => openInstagramProfile(artist.instagram_handle)}
                          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-ink"
                        >
                          인스타 열기
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(artist)}
                          className="rounded-lg border border-ink px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
                        >
                          수정/정보
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(artist)}
                          className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                        >
                          삭제
                        </button>
                        {isSaving ? (
                          <span className="text-xs font-medium text-slate-400">저장 중...</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
