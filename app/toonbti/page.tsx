import type { Metadata } from "next";
import Link from "next/link";

import { ToonTestRunner } from "@/components/toonbti/ToonTestRunner";
import { listPublicCharacterUrls } from "@/lib/server/public-artists";
import { getPublishedToonbtiConfig } from "@/lib/server/toonbti";
import { CANONICAL_SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "툰비티아이 | 인투니",
  description: "4가지 성향축으로 나와 잘 맞는 인스타툰 작가를 찾는 테스트입니다.",
  alternates: { canonical: `${CANONICAL_SITE_URL}/toonbti` },
  openGraph: { url: `${CANONICAL_SITE_URL}/toonbti` }
};

export const dynamic = "force-dynamic";

export default async function ToonbtiPage() {
  const [config, characterUrls] = await Promise.all([
    getPublishedToonbtiConfig().catch(() => null),
    listPublicCharacterUrls().catch(() => [])
  ]);
  const floatingCharacterUrls = [...characterUrls]
    .sort(() => Math.random() - 0.5);

  return (
    <main className="min-h-screen bg-[#f8f7f4] text-[#1a1a1a]">
      <nav className="sticky top-0 z-40 flex h-[60px] items-center justify-between border-b border-[rgba(0,0,0,0.07)] bg-[rgba(248,247,244,0.93)] px-5 backdrop-blur-md md:px-8">
        <Link href="/" className="font-moyamoya text-[22px] text-[#ff4d6d]">
          인투니<span className="text-[#1a1a1a]">.</span>
        </Link>
        <Link
          href="/"
          className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-4 py-2 text-sm font-bold text-[#6b6b6b] transition hover:border-[#ff4d6d] hover:text-[#ff4d6d]"
        >
          홈으로
        </Link>
      </nav>

      {config ? (
        <ToonTestRunner config={config} characterUrls={floatingCharacterUrls} />
      ) : (
        <section className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-3xl items-center justify-center px-5 py-16 text-center md:px-8">
          <div className="w-full border-y border-[#ffd6df] bg-white px-6 py-14 md:px-10">
          <p className="text-sm font-black uppercase text-[#ff4d6d]">ToonBTI Update</p>
          <h1 className="mt-5 font-moyamoya text-4xl leading-tight text-[#1a1a1a] md:text-6xl">
            툰비티아이는
            <br />
            개선중이에요!
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#6b6b6b]">
            질문과 결과 카드로 더 잘 맞는 작가를 연결하는 새 테스트를 준비하고 있습니다.
          </p>
          </div>
        </section>
      )}
    </main>
  );
}
