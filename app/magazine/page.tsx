import Image from "next/image";
import Link from "next/link";

import { getSupabasePublicServerClient } from "@/lib/supabase";

export default async function MagazineListPage() {
  const supabase = getSupabasePublicServerClient();
  const { data: magazines } = await supabase
    .from("magazines")
    .select("*")
    .eq("is_public", true)
    .order("published_at", { ascending: false });

  const items = magazines ?? [];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-8 md:py-14">
      <section className="space-y-3">
        <p className="text-sm font-semibold text-[#c9153d]">MAGAZINE</p>
        <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[#1a1a1a] md:text-5xl">
          인투니 매거진
        </h1>
        <p className="max-w-2xl text-[15px] leading-7 text-[#6b6b6b]">
          인투니에 올라온 매거진들을 한 곳에서 모아볼 수 있어요. 최신 매거진부터
          차례대로 살펴보세요.
        </p>
      </section>

      {items.length === 0 ? (
        <div className="mt-10 rounded-[28px] border border-[rgba(0,0,0,0.08)] bg-white px-6 py-16 text-center shadow-[0_14px_36px_rgba(0,0,0,0.04)]">
          <p className="text-base font-semibold text-[#1a1a1a]">아직 등록된 매거진이 없어요.</p>
          <p className="mt-2 text-sm text-[#8a8a8a]">
            첫 번째 매거진이 올라오면 여기에서 바로 확인할 수 있어요.
          </p>
        </div>
      ) : (
        <section className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((magazine) => (
            <Link
              key={magazine.id}
              href={`/magazine/${magazine.id}`}
              className="overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_16px_36px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
            >
              <div className="relative aspect-[2/1] bg-[#f2f0ec]">
                <Image
                  src={magazine.thumbnail_url || "https://placehold.co/800x400?text=Magazine"}
                  alt={magazine.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                />
              </div>
              <div className="space-y-3 px-5 py-5">
                {magazine.tag && (
                  <p className="text-[11px] font-semibold text-[#c9153d]">{magazine.tag}</p>
                )}
                <h2 className="line-clamp-2 text-[22px] font-extrabold tracking-[-0.03em] text-[#1a1a1a]">
                  {magazine.title}
                </h2>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
