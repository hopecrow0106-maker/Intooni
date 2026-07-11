import Link from "next/link";

import HomeClient from "@/components/home/HomeClient";
import { listPublicArtists } from "@/lib/server/public-artists";
import { listPublicMagazines } from "@/lib/server/public-magazines";
import { getSupabasePublicServerClient } from "@/lib/supabase";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getPublicCategories() {
  try {
    const supabase = getSupabasePublicServerClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  } catch {
    return [] as Category[];
  }
}

function artistPath(handle: string) {
  return `/artists/${encodeURIComponent(handle.replace(/^@/, "").trim())}`;
}

export default async function HomePage() {
  const [artists, categories, magazines] = await Promise.all([
    listPublicArtists().catch(() => []),
    getPublicCategories(),
    listPublicMagazines().catch(() => [])
  ]);

  return (
    <>
      <HomeClient
        initialArtists={artists}
        initialCategories={categories}
        initialMagazines={magazines}
      />
      <noscript>
        <nav aria-label="인투니 작가 링크">
          <ul>
            {artists.slice(0, 100).map((artist) => (
              <li key={artist.id}>
                <Link href={artistPath(artist.instagram_handle)}>{artist.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </noscript>
    </>
  );
}
