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
  onToggleTrending: (artist: Artist) => void;
  onReorder: (artists: Artist[]) => void;
  isSaving: boolean;
  reorderEnabled?: boolean;
};

function reorderList(items: Artist[], startIndex: number, endIndex: number) {
  const nextItems = [...items];
  const [removed] = nextItems.splice(startIndex, 1);
  nextItems.splice(endIndex, 0, removed);
  return nextItems.map((artist, index) => ({ ...artist, sort_order: index }));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function getPeriodLabel(period: ArtistStatsPeriod) {
  if (period === "day") return "오늘";
  if (period === "week") return "7일";
  if (period === "year") return "1년";
  return "전체";
}

function getStatusStyle(status: Artist["status"]) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "hidden") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function getStatusLabel(status: Artist["status"]) {
  if (status === "active") return "활성";
  if (status === "hidden") return "숨김";
  return "보관";
}

function DataBadges({ artist }: { artist: Artist }) {
  const missingSearchTags = artist.search_tags.map((tag) => tag.trim()).filter(Boolean).length === 0;
  const missingCharacter = !artist.character_url.trim();

  if (!missingSearchTags && !missingCharacter) {
    return <span className="text-xs font-medium text-emerald-600">정상</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {missingSearchTags ? (
        <span className="rounded bg-orange-50 px-1.5 py-1 text-[11px] font-semibold text-orange-700">
          검색 태그 누락
        </span>
      ) : null}
      {missingCharacter ? (
        <span className="rounded bg-sky-50 px-1.5 py-1 text-[11px] font-semibold text-sky-700">
          캐릭터 PNG 누락
        </span>
      ) : null}
    </div>
  );
}

function MiniSwitch({ active, label, onClick }: { active: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`relative h-5 w-9 rounded-full transition ${
        active ? "bg-blue-600" : "bg-slate-300"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
          active ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function ArtistTable({
  artists,
  statsByArtistId,
  statsPeriod,
  onEdit,
  onDelete,
  onToggleTrending,
  onReorder,
  isSaving,
  reorderEnabled = true
}: ArtistTableProps) {
  const [localArtists, setLocalArtists] = useState(artists);

  useEffect(() => setLocalArtists(artists), [artists]);

  const handleDragEnd = (result: DropResult) => {
    if (!reorderEnabled || !result.destination) return;
    const nextArtists = reorderList(localArtists, result.source.index, result.destination.index);
    setLocalArtists(nextArtists);
    onReorder(nextArtists);
  };

  const openInstagramProfile = (handle: string) => {
    const normalizedHandle = handle.replace(/^@/, "").trim();
    if (normalizedHandle) {
      window.open(`https://www.instagram.com/${normalizedHandle}/`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="hidden grid-cols-[minmax(230px,1.5fr)_minmax(150px,0.8fr)_88px_90px_90px_minmax(150px,1fr)_110px_210px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 xl:grid">
        <span>작가</span>
        <span>계정 · 카테고리</span>
        <span>상태</span>
        <span>사이트 공개</span>
        <span>요즘 뜨는 작가</span>
        <span>데이터 상태</span>
        <span>{getPeriodLabel(statsPeriod)} 반응</span>
        <span className="text-right">관리</span>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="artist-table">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-slate-100">
              {localArtists.map((artist, index) => {
                const stats = statsByArtistId[artist.id] ?? {
                  artist_id: artist.id,
                  ...EMPTY_ARTIST_STATS
                };
                const statsTotal = stats.artist_click + stats.instagram_outbound;

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
                        className="grid gap-3 px-4 py-3 transition hover:bg-slate-50 xl:grid-cols-[minmax(230px,1.5fr)_minmax(150px,0.8fr)_88px_90px_90px_minmax(150px,1fr)_110px_210px] xl:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            {...dragProvided.dragHandleProps}
                            className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 ${
                              reorderEnabled ? "cursor-grab" : ""
                            }`}
                          >
                            <Image
                              src={artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER}
                              alt={artist.name}
                              fill
                              className="object-cover"
                              sizes="44px"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink">{artist.name}</p>
                            <div className="mt-1 flex flex-wrap gap-1 xl:hidden">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getStatusStyle(artist.status)}`}>
                                {getStatusLabel(artist.status)}
                              </span>
                              {artist.is_trending ? (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">성장 공개</span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 text-xs">
                          <p className="truncate font-medium text-slate-600">@{artist.instagram_handle}</p>
                          <p className="mt-1 truncate text-slate-400">{artist.genre || "카테고리 없음"}</p>
                        </div>

                        <div className="hidden xl:block">
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${getStatusStyle(artist.status)}`}>
                            {getStatusLabel(artist.status)}
                          </span>
                        </div>

                        <div className="hidden xl:block">
                          <MiniSwitch active={artist.status === "active" && artist.show_on_site === true} label="사이트 공개 상태" />
                        </div>

                        <div className="hidden xl:block">
                          <MiniSwitch
                            active={artist.is_trending}
                            label="요즘 뜨는 작가 전환"
                            onClick={() => onToggleTrending(artist)}
                          />
                        </div>

                        <div><DataBadges artist={artist} /></div>

                        <div className="text-xs">
                          <p className="font-bold text-slate-700">{formatNumber(statsTotal)}</p>
                          <p className="mt-0.5 text-slate-400">클릭 {formatNumber(stats.artist_click)}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => onEdit(artist)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => openInstagramProfile(artist.instagram_handle)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-400"
                          >
                            인스타그램
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => onDelete(artist)}
                            className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            보관
                          </button>
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
    </div>
  );
}
