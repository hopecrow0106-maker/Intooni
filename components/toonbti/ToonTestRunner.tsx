"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { TrackedArtistActionLink } from "@/components/TrackedArtistActionLink";
import { ARTIST_SQUARE_PLACEHOLDER } from "@/lib/placeholders";
import type { PublicToonTestDTO } from "@/lib/server/toon-tests";

export function ToonTestRunner({ test }: { test: PublicToonTestDTO }) {
  const [nodeId, setNodeId] = useState(test.draft.startNodeId);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const node = useMemo(
    () => test.draft.nodes.find((item) => item.id === nodeId) ?? null,
    [nodeId, test.draft.nodes]
  );
  const options = useMemo(
    () => test.draft.options.filter((option) => option.questionId === nodeId),
    [nodeId, test.draft.options]
  );
  const artistMap = useMemo(
    () => new Map(test.artists.map((artist) => [artist.id, artist])),
    [test.artists]
  );

  const reset = () => {
    setNodeId(test.draft.startNodeId);
    setSelectedOptionIds([]);
  };

  const chooseSingle = (optionId: string, nextNodeId: string) => {
    setSelectedOptionIds([optionId]);
    setNodeId(nextNodeId);
    setSelectedOptionIds([]);
  };

  const continueMulti = () => {
    const selected = options.filter((option) => selectedOptionIds.includes(option.id));
    const nextNodeId = selected[selected.length - 1]?.nextNodeId;
    if (!nextNodeId) return;
    setNodeId(nextNodeId);
    setSelectedOptionIds([]);
  };

  if (!node) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">테스트 경로를 불러오지 못했습니다.</p>
        <button type="button" onClick={reset} className="mt-5 text-sm font-bold text-[#c9153d]">
          처음으로
        </button>
      </div>
    );
  }

  if (node.type === "result") {
    const artists = node.artistIds.map((artistId) => artistMap.get(artistId)).filter(Boolean);
    return (
      <section className="mx-auto w-full max-w-4xl px-5 py-12 text-center md:px-8">
        {node.imageUrl ? (
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-slate-100">
            <Image src={node.imageUrl} alt={node.title} fill className="object-cover" sizes="384px" />
          </div>
        ) : null}
        <p className="mt-7 text-sm font-bold text-[#c9153d]">RESULT</p>
        <h1 className="mt-2 text-4xl font-extrabold text-[#1a1a1a] md:text-5xl">{node.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl whitespace-pre-wrap text-base leading-8 text-slate-600">
          {node.description}
        </p>
        {node.traits ? <p className="mt-3 text-sm font-semibold text-slate-400">{node.traits}</p> : null}

        {artists.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) =>
              artist ? (
                <TrackedArtistActionLink
                  key={artist.id}
                  artistId={artist.id}
                  eventType="artist_click"
                  href={`/artists/${encodeURIComponent(artist.instagram_handle)}`}
                  target="_self"
                  className="border border-slate-200 bg-white p-4 text-left transition hover:border-[#ff4d6d]"
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <Image
                      src={artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER}
                      alt={artist.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 280px"
                    />
                  </div>
                  <p className="mt-3 text-lg font-bold text-[#1a1a1a]">{artist.name}</p>
                  <p className="mt-1 text-sm text-slate-500">@{artist.instagram_handle}</p>
                </TrackedArtistActionLink>
              ) : null
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-10 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700"
        >
          다시 테스트하기
        </button>
      </section>
    );
  }

  const multi = node.selectionMode === "multi";
  return (
    <section className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-3xl items-center px-5 py-12 md:px-8">
      <div className="w-full">
        <p className="text-sm font-bold text-[#c9153d]">{test.title}</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[#1a1a1a] md:text-5xl">
          {node.title}
        </h1>
        {node.description ? (
          <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-slate-600">{node.description}</p>
        ) : null}
        <div className="mt-8 grid gap-3">
          {options.map((option) => {
            const selected = selectedOptionIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (!multi) {
                    chooseSingle(option.id, option.nextNodeId);
                    return;
                  }
                  setSelectedOptionIds((current) => {
                    if (current.includes(option.id)) return current.filter((id) => id !== option.id);
                    if (current.length >= node.maxSelections) return current;
                    return [...current, option.id];
                  });
                }}
                className={`min-h-14 border px-5 py-4 text-left text-base font-bold transition ${
                  selected
                    ? "border-[#ff4d6d] bg-[#fff0f3] text-[#c9153d]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {multi ? (
          <button
            type="button"
            disabled={selectedOptionIds.length === 0}
            onClick={continueMulti}
            className="mt-5 w-full bg-[#1a1a1a] px-5 py-4 text-sm font-bold text-white disabled:bg-slate-300"
          >
            다음
          </button>
        ) : null}
      </div>
    </section>
  );
}
