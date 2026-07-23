import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ToonbtiArtistCard } from "@/components/toonbti/ToonbtiArtistCard";
import { ToonbtiResultActions } from "@/components/toonbti/ToonbtiResultActions";
import {
  getActiveToonbtiAxes,
  getActiveTraitsForAxis
} from "@/lib/domain/toonbti";
import { getPublishedToonbtiResult } from "@/lib/server/toonbti";
import { CANONICAL_SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

type PageProps = { params: { resultCode: string } };
const loadResult = cache((code: string) => getPublishedToonbtiResult(code));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await loadResult(params.resultCode).catch(() => null);
  if (!data) return { title: "툰비티아이 결과 | 인투니" };
  const title = `${data.resultType.code} ${data.resultType.name} | 툰비티아이`;
  const url = `${CANONICAL_SITE_URL}/toonbti/result/${encodeURIComponent(data.resultType.code)}`;
  const images = data.resultType.shareImageUrl || data.resultType.imageUrl;
  return {
    title,
    description: data.resultType.shortDescription,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: data.resultType.shortDescription,
      url,
      images: images ? [{ url: images }] : undefined
    }
  };
}

export default async function ToonbtiResultPage({ params }: PageProps) {
  const data = await loadResult(params.resultCode).catch(() => null);
  if (!data) notFound();

  const axes = getActiveToonbtiAxes(data.config);
  const selectedTraits = axes.map((axis, index) => {
    const code = data.resultType.code[index];
    return getActiveTraitsForAxis(data.config, axis.id).find((trait) => trait.code === code) ?? null;
  });
  const traitNames = selectedTraits.map((trait, index) => trait?.name ?? data.resultType.code[index]);
  const resultUrl = `${CANONICAL_SITE_URL}/toonbti/result/${encodeURIComponent(data.resultType.code)}`;

  return (
    <main className="min-h-screen bg-[#f8f7f4] text-[#1a1a1a]">
      <nav className="flex h-[60px] items-center justify-between border-b border-black/5 px-5 md:px-8">
        <Link href="/" className="font-moyamoya text-[22px] text-[#ff4d6d]">
          인투니<span className="text-[#1a1a1a]">.</span>
        </Link>
        <Link href="/toonbti" className="text-sm font-bold text-slate-600">
          테스트로
        </Link>
      </nav>
      <section className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-16">
        <div className="grid gap-8 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[360px_1fr] md:p-8">
          {data.resultType.imageUrl ? (
            <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
              <Image
                src={data.resultType.imageUrl}
                alt={`${data.resultType.name} 결과 이미지`}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 90vw, 360px"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-[#fff0f3] text-7xl font-black text-[#ff4d6d]">
              {data.resultType.code}
            </div>
          )}
          <div className="flex flex-col justify-center">
            <p className="text-sm font-black text-[#ff4d6d]">MY TOON-BTI</p>
            <p className="mt-3 text-5xl font-black md:text-7xl">{data.resultType.code}</p>
            <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">{data.resultType.name}</h1>
            <div className="mt-5 flex flex-wrap gap-2">
              {traitNames.map((trait) => (
                <span key={trait} className="rounded-full bg-[#f1edff] px-3 py-1.5 text-sm font-bold text-[#6d4aff]">
                  {trait}
                </span>
              ))}
            </div>
            <p className="mt-6 text-lg font-bold leading-8 text-slate-700">
              {data.resultType.shortDescription}
            </p>
            {data.resultType.keywords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.resultType.keywords.map((keyword) => (
                  <span key={keyword} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                    #{keyword}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {data.resultType.longDescription}
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {selectedTraits.map((trait, index) =>
                trait ? (
                  <div key={trait.id} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm font-extrabold">
                      {trait.code} · {trait.name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{trait.description}</p>
                  </div>
                ) : (
                  <div key={`missing-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm font-bold">
                    {data.resultType.code[index]}
                  </div>
                )
              )}
            </div>
            <div className="mt-7">
              <ToonbtiResultActions
                data={{
                  testId: data.config.test.id,
                  code: data.resultType.code,
                  name: data.resultType.name,
                  shortDescription: data.resultType.shortDescription,
                  traitNames,
                  shareText: data.resultType.shareText || data.config.test.shareText,
                  imageUrl: data.resultType.imageUrl,
                  resultUrl
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-extrabold">이 유형과 잘 맞는 작가</h2>
          {data.artists.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.artists.map((artist) => (
                <ToonbtiArtistCard
                  key={artist.id}
                  artist={artist}
                  testId={data.config.test.id}
                  resultCode={data.resultType.code}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <p className="font-bold text-slate-700">아직 이 유형에 연결된 공개 작가가 없습니다.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link href="/" className="rounded-full bg-[#ff4d6d] px-5 py-2.5 text-sm font-bold text-white">
                  작가 둘러보기
                </Link>
                <Link href="/toonbti" className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold">
                  다시 테스트
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
