"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  FilterBar,
  type FollowerRangeKey,
  type GenreFilterItem
} from "@/components/FilterBar";
import { ArtistCard } from "@/components/ArtistCard";
import { ArtistModal } from "@/components/ArtistModal";
import { SearchBar } from "@/components/SearchBar";
import { ARTIST_SQUARE_PLACEHOLDER, MAGAZINE_RECT_PLACEHOLDER } from "@/lib/placeholders";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Artist, Category, Magazine } from "@/lib/types";

const INITIAL_ARTIST_BATCH = 12;
const ARTIST_BATCH_SIZE = 12;
const INQUIRY_MESSAGE = "jaamstudio@naver.com 로 연락주세요!";
const HERO_DELAYS = ["0s", "0.7s", "0.3s", "1s"] as const;

type HeroDecoration = {
  artist: Artist;
  duration: number;
  delay: string;
  driftX: number;
  driftY: number;
};

function matchesFollowerRange(value: number, range: FollowerRangeKey) {
  switch (range) {
    case "under10k":
      return value < 10_000;
    case "10kTo50k":
      return value >= 10_000 && value < 50_000;
    case "50kTo100k":
      return value >= 50_000 && value < 100_000;
    case "over100k":
      return value >= 100_000;
    default:
      return true;
  }
}

function formatFollowerCount(value: number) {
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(1).replace(/\.0$/, "")}만`;
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

function createRandomOrderMap(artists: Artist[]) {
  return [...artists]
    .sort(() => Math.random() - 0.5)
    .reduce<Record<string, number>>((acc, artist, index) => {
      acc[artist.id] = index;
      return acc;
    }, {});
}

function pickHeroDecorations(artists: Artist[]): HeroDecoration[] {
  const fixedAds = [...artists]
    .filter((artist) => artist.is_ad && artist.character_url.trim())
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 4);

  const randomPool = artists.filter((artist) => artist.character_url.trim());
  const randomFallback = [...randomPool].sort(() => Math.random() - 0.5).slice(0, 4);
  const selected = (fixedAds.length > 0 ? fixedAds : randomFallback).slice(0, 4);

  return selected.map((artist, index) => ({
    artist,
    duration: 6 + Math.random() * 3,
    delay: HERO_DELAYS[index] ?? "0s",
    driftX: (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 12),
    driftY: 8 + Math.random() * 10
  }));
}

function AdSidebarPlaceholder() {
  return <div className="sticky top-20 min-h-[600px] w-[160px] rounded-lg bg-gray-100/40" />;
}

function ArtistSkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white">
      <div className="aspect-square animate-pulse bg-[#f2f0ec]" />
      <div className="space-y-2.5 p-3.5">
        <div className="h-4 w-24 animate-pulse rounded-full bg-[#f2f0ec]" />
        <div className="flex gap-1.5">
          <div className="h-5 w-14 animate-pulse rounded-full bg-[#f2f0ec]" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-[#f2f0ec]" />
        </div>
        <div className="flex gap-3">
          <div className="h-3.5 w-14 animate-pulse rounded-full bg-[#f2f0ec]" />
          <div className="h-3.5 w-12 animate-pulse rounded-full bg-[#f2f0ec]" />
        </div>
      </div>
    </div>
  );
}

function HorizontalArtistCard({
  artist,
  index,
  onClick
}: {
  artist: Artist;
  index: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="trending-card text-left">
      <span className="trending-rank">{index + 1}</span>
      <div className="relative aspect-square overflow-hidden bg-[#f2f0ec]">
        <Image
          src={artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER}
          alt={artist.name}
          fill
          className="object-cover"
          sizes="240px"
        />
      </div>
      <div className="trending-info">
        <p className="trending-name">{artist.name}</p>
        <p className="trending-sub">
          {artist.genre} · {formatFollowerCount(artist.followers)}
        </p>
      </div>
    </button>
  );
}

function NewArtistGridCard({
  artist,
  index,
  onClick
}: {
  artist: Artist;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white text-left transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
    >
      <span className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#1e243d] text-lg font-bold text-white">
        {index + 1}
      </span>
      <div className="relative aspect-square overflow-hidden bg-[#f2f0ec]">
        <Image
          src={artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER}
          alt={artist.name}
          fill
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 280px"
        />
      </div>
      <div className="space-y-1 px-5 pb-5 pt-4">
        <p className="text-[15px] font-bold tracking-[-0.02em] text-[#1a1a1a]">{artist.name}</p>
        <p className="text-sm text-[#8a8a8a]">
          {artist.genre} · {formatFollowerCount(artist.followers)}
        </p>
      </div>
    </button>
  );
}

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [paginatedArtists, setPaginatedArtists] = useState<Artist[]>([]);
  const [searchArtists, setSearchArtists] = useState<Artist[] | null>(null);
  const [artistRandomOrder, setArtistRandomOrder] = useState<Record<string, number>>({});
  const [artistCount, setArtistCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [genreCounts, setGenreCounts] = useState<Record<string, number>>({});
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [heroDecorations, setHeroDecorations] = useState<HeroDecoration[]>([]);
  const [featuredHotArtists, setFeaturedHotArtists] = useState<Artist[]>([]);
  const [featuredNewArtists, setFeaturedNewArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeGenres, setActiveGenres] = useState<string[]>([]);
  const [activeFollowerRanges, setActiveFollowerRanges] = useState<FollowerRangeKey[]>([]);
  const [showFollowerFilters, setShowFollowerFilters] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [typedInquiryText, setTypedInquiryText] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMoreArtists, setHasMoreArtists] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastLoggedSearchRef = useRef("");

  const isSearching = search.trim().length > 0 || activeGenres.length > 0 || activeFollowerRanges.length > 0;

  const trackArtistEvent = (artistId: string, eventType: "profile_click" | "hero_click") => {
    void fetch("/api/artist-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ artistId, eventType }),
      keepalive: true
    }).catch(() => undefined);
  };

  const openArtistModal = (artist: Artist, eventType: "profile_click" | "hero_click") => {
    trackArtistEvent(artist.id, eventType);
    setSelectedArtist(artist);
  };

  const loadPaginatedArtists = useCallback(async (nextPage: number, reset = false) => {
    if (!supabase) {
      return;
    }

    const from = nextPage * ARTIST_BATCH_SIZE;
    const to = from + ARTIST_BATCH_SIZE - 1;

    const { data, error, count } = await supabase
      .from("artists")
      .select("*", { count: "exact" })
      .order("is_ad", { ascending: false })
      .order("sort_order", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const nextArtists = data ?? [];

    setArtistCount(count ?? 0);
    setPaginatedArtists((current) => {
      const merged = reset ? nextArtists : [...current, ...nextArtists];
      setArtistRandomOrder((prev) => {
        const nextMap = reset ? {} : { ...prev };
        const startIndex = Object.keys(nextMap).length;
        [...nextArtists]
          .sort(() => Math.random() - 0.5)
          .forEach((artist, index) => {
            if (nextMap[artist.id] === undefined) {
              nextMap[artist.id] = startIndex + index;
            }
          });
        return nextMap;
      });
      return merged;
    });

    setHasMoreArtists(nextArtists.length === ARTIST_BATCH_SIZE && (count ?? 0) > to + 1);
    setPageIndex(nextPage);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      setLoading(true);

      if (!supabase) {
        setLoading(false);
        return;
      }

      const [categoriesResponse, genreResponse, magazinesResponse, heroResponse, hotResponse, newResponse] =
        await Promise.all([
          supabase.from("categories").select("*").order("sort_order", { ascending: true }),
          supabase.from("artists").select("id, genre"),
          supabase.from("magazines").select("*").order("published_at", { ascending: false }),
          supabase.from("artists").select("*").order("is_ad", { ascending: false }).order("sort_order", { ascending: true }).limit(16),
          supabase.from("artists").select("*").eq("is_hot", true).order("sort_order", { ascending: true }).limit(8),
          supabase.from("artists").select("*").order("created_at", { ascending: false }).limit(4)
        ]);

      if (!mounted) {
        return;
      }

      setCategories(categoriesResponse.error ? [] : (categoriesResponse.data ?? []));
      const counts =
        genreResponse.error || !genreResponse.data
          ? {}
          : genreResponse.data.reduce<Record<string, number>>((acc, artist) => {
              acc[artist.genre] = (acc[artist.genre] ?? 0) + 1;
              return acc;
            }, {});
      setGenreCounts(counts);
      setMagazines(magazinesResponse.error ? [] : (magazinesResponse.data ?? []));

      const heroArtists = heroResponse.error ? [] : (heroResponse.data ?? []);
      setHeroDecorations(pickHeroDecorations(heroArtists));

      const hotArtists = hotResponse.error ? [] : (hotResponse.data ?? []);
      setFeaturedHotArtists(hotArtists);

      const newArtists = newResponse.error ? [] : (newResponse.data ?? []);
      setFeaturedNewArtists([...newArtists].sort(() => Math.random() - 0.5));

      await loadPaginatedArtists(0, true);
      if (!mounted) {
        return;
      }

      setLoading(false);
    };

    void fetchInitialData();

    return () => {
      mounted = false;
    };
  }, [loadPaginatedArtists, supabase]);

  useEffect(() => {
    if (!showInquiryModal) {
      setTypedInquiryText("");
      return;
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedInquiryText(INQUIRY_MESSAGE.slice(0, index));

      if (index >= INQUIRY_MESSAGE.length) {
        window.clearInterval(timer);
      }
    }, 45);

    return () => window.clearInterval(timer);
  }, [showInquiryModal]);

  useEffect(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (lastLoggedSearchRef.current === normalizedQuery) {
        return;
      }

      void fetch("/api/search-queries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: normalizedQuery }),
        keepalive: true
      })
        .then((response) => {
          if (response.ok) {
            lastLoggedSearchRef.current = normalizedQuery;
          }
        })
        .catch(() => undefined);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    if (!isSearching) {
      setSearchArtists(null);
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);

    const loadSearchArtists = async () => {
      const { data, error } = await supabase.from("artists").select("*");

      if (!active) {
        return;
      }

      if (error) {
        setSearchArtists([]);
        setSearchLoading(false);
        return;
      }

      setSearchArtists(data ?? []);
      setSearchLoading(false);
    };

    void loadSearchArtists();

    return () => {
      active = false;
    };
  }, [isSearching, supabase]);

  const genreItems = useMemo<GenreFilterItem[]>(() => {
    const items: GenreFilterItem[] = [{ key: "전체", label: "전체", count: artistCount }];

    categories.forEach((category) => {
      items.push({
        key: category.name,
        label: category.name,
        count: genreCounts[category.name] ?? 0
      });
    });

    return items;
  }, [artistCount, categories, genreCounts]);

  const featuredMagazines = useMemo(() => magazines.slice(0, 3), [magazines]);

  const filteredArtists = useMemo(() => {
    const baseArtists = isSearching ? searchArtists ?? [] : paginatedArtists;
    const query = search.trim().toLowerCase();

    return [...baseArtists]
      .sort((a, b) => (artistRandomOrder[a.id] ?? 0) - (artistRandomOrder[b.id] ?? 0))
      .filter((artist) => {
        const visibleTags = artist.hashtags.map((tag) => tag.toLowerCase());
        const hiddenTags = artist.hidden_tags.map((tag) => tag.toLowerCase());
        const styleTags = artist.style_tags.map((tag) => tag.toLowerCase());
        const moodTags = artist.mood_tags.map((tag) => tag.toLowerCase());
        const topicTags = artist.topic_tags.map((tag) => tag.toLowerCase());
        const audienceTags = artist.target_audience_tags.map((tag) => tag.toLowerCase());
        const memo = artist.memo.toLowerCase();
        const bio = artist.bio.toLowerCase();

        const matchSearch =
          !query ||
          artist.name.toLowerCase().includes(query) ||
          visibleTags.some((tag) => tag.includes(query)) ||
          hiddenTags.some((tag) => tag.includes(query)) ||
          styleTags.some((tag) => tag.includes(query)) ||
          moodTags.some((tag) => tag.includes(query)) ||
          topicTags.some((tag) => tag.includes(query)) ||
          audienceTags.some((tag) => tag.includes(query)) ||
          memo.includes(query) ||
          bio.includes(query);

        const matchGenre = activeGenres.length === 0 || activeGenres.includes(artist.genre);
        const matchFollower =
          activeFollowerRanges.length === 0 ||
          activeFollowerRanges.some((range) => matchesFollowerRange(artist.followers, range));

        return matchSearch && matchGenre && matchFollower;
      });
  }, [activeFollowerRanges, activeGenres, artistRandomOrder, isSearching, paginatedArtists, search, searchArtists]);

  const gridTitle = useMemo(() => {
    if (search.trim()) {
      return `"${search}" 검색결과`;
    }

    if (activeGenres.length > 0) {
      return `${activeGenres.join(", ")} 작가`;
    }

    return "전체 작가";
  }, [activeGenres, search]);

  const visibleArtists = useMemo(
    () => (isSearching ? filteredArtists : filteredArtists),
    [filteredArtists, isSearching]
  );

  const regularVisibleArtists = useMemo(
    () =>
      visibleArtists.filter(
        (artist) => artist.thumbnail_url.trim() || !artist.gallery_post_urls.some((url) => url.trim())
      ),
    [visibleArtists]
  );

  const embeddedVisibleArtists = useMemo(
    () =>
      visibleArtists.filter(
        (artist) => !artist.thumbnail_url.trim() && artist.gallery_post_urls.some((url) => url.trim())
      ),
    [visibleArtists]
  );

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || loading || searchLoading || isSearching || !hasMoreArtists) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        void loadPaginatedArtists(pageIndex + 1);
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMoreArtists, isSearching, loadPaginatedArtists, loading, pageIndex, searchLoading]);

  const visibleCountLabel = isSearching ? filteredArtists.length : artistCount;
  const showLoadingState = loading || searchLoading;

  return (
    <>
      <nav className="sticky top-0 z-50 flex h-[60px] items-center gap-5 border-b border-[rgba(0,0,0,0.07)] bg-[rgba(248,247,244,0.93)] px-5 backdrop-blur-md md:px-8">
        <a
          href="/"
          className="shrink-0 font-moyamoya text-[22px] tracking-[-0.04em] text-[#ff4d6d]"
        >
          인투<span className="text-[#1a1a1a]">니</span>
        </a>
        <SearchBar value={search} onChange={setSearch} />
      </nav>

      <main className="mx-auto w-full max-w-[1520px] xl:grid xl:grid-cols-[160px_minmax(0,1fr)_160px] xl:gap-8 xl:px-6">
        <aside className="hidden xl:block">
          <AdSidebarPlaceholder />
        </aside>

        <div className="min-w-0">
          <section className="relative overflow-hidden px-5 pb-12 pt-16 text-center">
            {/*
              대각선 엇갈림 배치:
              [1] 작은 — 왼쪽 끝, 위쪽        [2] 큰 — 오른쪽 안쪽, 위쪽
                    [0] 큰 — 왼쪽 안쪽, 아래쪽        [3] 작은 — 오른쪽 끝, 아래쪽
            */}

            {/* ① 왼쪽 끝 · 위 (작은, md+) */}
            {heroDecorations[1] && (
              <a
                href={`https://instagram.com/${heroDecorations[1].artist.instagram_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackArtistEvent(heroDecorations[1].artist.id, "hero_click")}
                className="absolute left-0 top-3 z-10 hidden md:block"
                style={
                  {
                    animation: `hero-drift ${heroDecorations[1].duration}s ease-in-out infinite`,
                    animationDelay: heroDecorations[1].delay,
                    ["--hero-drift-x" as string]: `${Math.abs(heroDecorations[1].driftX)}px`,
                    ["--hero-drift-y" as string]: `${heroDecorations[1].driftY}px`,
                    padding: "20px",
                    margin: "-20px"
                  } as CSSProperties
                }
              >
                <Image
                  src={heroDecorations[1].artist.character_url}
                  alt={`${heroDecorations[1].artist.name} 캐릭터`}
                  width={130}
                  height={130}
                  className="h-[90px] w-[90px] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.13)] md:h-[110px] md:w-[110px] lg:h-[130px] lg:w-[130px]"
                />
              </a>
            )}

            {/* ② 왼쪽 안쪽 · 아래 (큰) — 왼쪽에서 10% 안으로 */}
            {heroDecorations[0] && (
              <a
                href={`https://instagram.com/${heroDecorations[0].artist.instagram_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackArtistEvent(heroDecorations[0].artist.id, "hero_click")}
                className="absolute bottom-2 z-10"
                style={
                  {
                    left: "8%",
                    animation: `hero-drift ${heroDecorations[0].duration}s ease-in-out infinite`,
                    animationDelay: heroDecorations[0].delay,
                    ["--hero-drift-x" as string]: `${Math.abs(heroDecorations[0].driftX)}px`,
                    ["--hero-drift-y" as string]: `${heroDecorations[0].driftY}px`,
                    padding: "20px",
                    margin: "-20px"
                  } as CSSProperties
                }
              >
                <Image
                  src={heroDecorations[0].artist.character_url}
                  alt={`${heroDecorations[0].artist.name} 캐릭터`}
                  width={195}
                  height={195}
                  className="h-[120px] w-[120px] object-contain drop-shadow-[0_16px_26px_rgba(0,0,0,0.15)] md:h-[160px] md:w-[160px] lg:h-[195px] lg:w-[195px]"
                />
              </a>
            )}

            {/* ③ 오른쪽 안쪽 · 위 (큰) — 오른쪽에서 10% 안으로 */}
            {heroDecorations[2] && (
              <a
                href={`https://instagram.com/${heroDecorations[2].artist.instagram_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackArtistEvent(heroDecorations[2].artist.id, "hero_click")}
                className="absolute top-3 z-10"
                style={
                  {
                    right: "8%",
                    animation: `hero-drift ${heroDecorations[2].duration}s ease-in-out infinite`,
                    animationDelay: heroDecorations[2].delay,
                    ["--hero-drift-x" as string]: `-${Math.abs(heroDecorations[2].driftX)}px`,
                    ["--hero-drift-y" as string]: `${heroDecorations[2].driftY}px`,
                    padding: "20px",
                    margin: "-20px"
                  } as CSSProperties
                }
              >
                <Image
                  src={heroDecorations[2].artist.character_url}
                  alt={`${heroDecorations[2].artist.name} 캐릭터`}
                  width={205}
                  height={205}
                  className="h-[130px] w-[130px] object-contain drop-shadow-[0_16px_26px_rgba(0,0,0,0.15)] md:h-[165px] md:w-[165px] lg:h-[205px] lg:w-[205px]"
                />
              </a>
            )}

            {/* ④ 오른쪽 끝 · 아래 (작은, md+) */}
            {heroDecorations[3] && (
              <a
                href={`https://instagram.com/${heroDecorations[3].artist.instagram_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackArtistEvent(heroDecorations[3].artist.id, "hero_click")}
                className="absolute bottom-3 right-0 z-10 hidden md:block"
                style={
                  {
                    animation: `hero-drift ${heroDecorations[3].duration}s ease-in-out infinite`,
                    animationDelay: heroDecorations[3].delay,
                    ["--hero-drift-x" as string]: `-${Math.abs(heroDecorations[3].driftX)}px`,
                    ["--hero-drift-y" as string]: `${heroDecorations[3].driftY}px`,
                    padding: "20px",
                    margin: "-20px"
                  } as CSSProperties
                }
              >
                <Image
                  src={heroDecorations[3].artist.character_url}
                  alt={`${heroDecorations[3].artist.name} 캐릭터`}
                  width={120}
                  height={120}
                  className="h-[85px] w-[85px] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.13)] md:h-[100px] md:w-[100px] lg:h-[120px] lg:w-[120px]"
                />
              </a>
            )}

            <div className="relative z-20">
              <h1
                className="mx-auto mb-3 max-w-3xl font-moyamoya text-[#1a1a1a]"
                style={{
                  fontSize: "clamp(32px, 5.5vw, 54px)",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em"
                }}
              >
                모든 인스타툰,
                <br />
                한 곳에서 <em className="not-italic text-[#ff4d6d]">발견</em>하세요
              </h1>
              <p className="mx-auto max-w-md text-[15px] leading-[1.7] text-[#1a1a1a]">
                그 계정 뭐였지..?
                <br />
                아이디가 안 떠올라도
                <br />
                떠오르는 <span className="text-[#ff4d6d]">키워드</span>로 찾아봐요!
              </p>
            </div>
          </section>

          <section className="px-5 pb-9">
            <FilterBar
              genreItems={genreItems}
              activeGenres={activeGenres}
              activeFollowerRanges={activeFollowerRanges}
              showFollowerFilters={showFollowerFilters}
              onToggleGenre={(genre) => {
                if (genre === "전체") {
                  setActiveGenres([]);
                  return;
                }

                setActiveGenres((current) =>
                  current.includes(genre)
                    ? current.filter((item) => item !== genre)
                    : [...current, genre]
                );
              }}
              onToggleFollowerRange={(range) =>
                setActiveFollowerRanges((current) =>
                  current.includes(range)
                    ? current.filter((item) => item !== range)
                    : [...current, range]
                )
              }
              onToggleFollowerFilters={() => setShowFollowerFilters((current) => !current)}
            />
          </section>

          <div className="mx-auto mb-10 max-w-[1200px] px-5 md:px-8">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowInquiryModal(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setShowInquiryModal(true);
                }
              }}
              className="flex w-full cursor-pointer items-center gap-5 rounded-[20px] px-6 py-5 text-white transition hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, #FF4D6D 0%, #FF8C69 100%)" }}
            >
              <span className="shrink-0 text-4xl">📣</span>
              <div className="min-w-0 text-left">
                <h3 className="mb-0.5 text-[17px] font-extrabold tracking-[-0.02em]">
                  인스타툰 작가신가요?
                </h3>
                <p className="text-sm leading-snug opacity-80">
                  인투니에 등록하면 광고주·브랜드가 먼저 연락해와요
                </p>
              </div>
            </div>
          </div>

          <div className="mx-auto mb-10 max-w-[1200px] px-5 md:px-8">
            <a
              href="https://forms.gle/1urGhUvYyJfGjY2H7"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-5 rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white px-6 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
            >
              <span className="shrink-0 text-4xl">📝</span>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="mb-0.5 text-[17px] font-extrabold tracking-[-0.02em] text-[#1a1a1a]">
                  인투니 작가 등록 신청
                </h3>
                <p className="text-sm leading-snug text-[#6b6b6b]">
                  구글 폼으로 작가 정보를 작성해주시면 검토 후 인투니에 등록할게요
                </p>
              </div>
              <span className="rounded-full bg-[#fff0f3] px-4 py-2 text-sm font-semibold text-[#c9153d]">
                신청하러 가기 →
              </span>
            </a>
          </div>

          {!isSearching && featuredMagazines.length > 0 ? (
            <section className="mx-auto mb-12 max-w-[1200px] px-5 md:px-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#1a1a1a]">
                  이달의 매거진
                </h2>
                <Link
                  href="/magazine"
                  className="text-sm font-medium text-[#8a8a8a] transition hover:text-[#ff4d6d]"
                >
                  더보기 →
                </Link>
              </div>
              <div className="trending-row">
                {featuredMagazines.map((magazine) => (
                  <Link
                    key={magazine.id}
                    href={`/magazine/${magazine.id}`}
                    className="magazine-card block"
                  >
                    <div className="relative aspect-[2/1] overflow-hidden bg-[#f2f0ec]">
                      <Image
                        src={magazine.thumbnail_url || MAGAZINE_RECT_PLACEHOLDER}
                        alt={magazine.title}
                        fill
                        className="object-cover"
                        sizes="280px"
                      />
                    </div>
                    <div className="magazine-card-info">
                      {magazine.tag ? (
                        <p className="mb-2 text-[11px] font-semibold text-[#c9153d]">
                          {magazine.tag}
                        </p>
                      ) : null}
                      <p className="magazine-card-title line-clamp-2">{magazine.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {!isSearching && featuredHotArtists.length > 0 ? (
            <section className="mx-auto mb-12 max-w-[1200px] px-5 md:px-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#1a1a1a]">
                  🔥 요즘 뜨는 작가들
                </h2>
              </div>
              <div className="trending-row">
                {featuredHotArtists.map((artist, index) => (
                  <HorizontalArtistCard
                    key={artist.id}
                    artist={artist}
                    index={index}
                    onClick={() => openArtistModal(artist, "profile_click")}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!isSearching && featuredNewArtists.length > 0 ? (
            <section className="mx-auto mb-12 max-w-[1200px] px-5 md:px-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#1a1a1a]">
                  ✨ 새로운 인투니들!
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {featuredNewArtists.map((artist, index) => (
                  <NewArtistGridCard
                    key={artist.id}
                    artist={artist}
                    index={index}
                    onClick={() => openArtistModal(artist, "profile_click")}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <div className="mx-auto max-w-[1200px] px-5 pb-20 md:px-8">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#1a1a1a]">
                {gridTitle}
              </h2>
              {!showLoadingState ? (
                <span className="text-sm text-[#a0a0a0]">총 {visibleCountLabel}명</span>
              ) : null}
            </div>

            {showLoadingState ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <ArtistSkeletonCard key={index} />
                ))}
              </div>
            ) : filteredArtists.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white px-6 py-14 text-center">
                <span className="mb-3 text-5xl">🔍</span>
                <p className="text-base font-bold tracking-[-0.02em] text-[#1a1a1a]">
                  검색 결과가 없어요
                </p>
                <p className="mt-1.5 text-sm text-[#6b6b6b]">
                  다른 키워드나 카테고리 조합으로 다시 찾아보세요
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {regularVisibleArtists.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {regularVisibleArtists.map((artist, index) => (
                      <ArtistCard
                        key={artist.id}
                        artist={artist}
                        index={index}
                        onClick={() => openArtistModal(artist, "profile_click")}
                      />
                    ))}
                  </div>
                ) : null}

                {embeddedVisibleArtists.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold tracking-[-0.02em] text-[#1a1a1a]">
                        인스타 게시물로 보는 작가
                      </h3>
                      <span className="text-sm text-[#a0a0a0]">
                        {embeddedVisibleArtists.length}명
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {embeddedVisibleArtists.map((artist, index) => (
                        <ArtistCard
                          key={artist.id}
                          artist={artist}
                          index={regularVisibleArtists.length + index}
                          onClick={() => openArtistModal(artist, "profile_click")}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {!showLoadingState && !isSearching && artistCount > 0 ? (
              <div className="pt-6">
                {hasMoreArtists ? (
                  <>
                    <div ref={loadMoreRef} className="h-8 w-full" />
                    <p className="text-center text-sm text-[#a0a0a0]">
                      아래로 더 내리면 작가를 더 불러와요
                    </p>
                  </>
                ) : (
                  <p className="text-center text-sm text-[#a0a0a0]">
                    모든 작가를 확인했어요
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="hidden xl:block">
          <AdSidebarPlaceholder />
        </aside>
      </main>

      <footer className="border-t border-[rgba(0,0,0,0.07)] py-10 text-center text-[13px] text-[#a0a0a0]">
        <p className="mb-2 font-medium">인투니 · 인스타툰 디렉토리 서비스</p>
        <p>문의: jaamstudio@naver.com</p>
        <p className="mt-3 text-[11px]">© 2025 인투니. All rights reserved.</p>
      </footer>

      {showInquiryModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(0,0,0,0.45)] px-5"
          onClick={() => setShowInquiryModal(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] border border-[rgba(0,0,0,0.08)] bg-white px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#ff4d6d]">Contact</p>
                <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-[#1a1a1a]">
                  작가 등록 문의
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInquiryModal(false)}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600"
              >
                닫기
              </button>
            </div>

            <div className="rounded-[22px] bg-[#fff7f8] px-5 py-5">
              <p className="min-h-[32px] text-[17px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
                {typedInquiryText}
                <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-[#ff4d6d] align-middle" />
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText("jaamstudio@naver.com");
              }}
              className="mt-4 w-full rounded-full bg-[#ff4d6d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e83a5a]"
            >
              이메일 복사하기
            </button>
          </div>
        </div>
      ) : null}

      <ArtistModal artist={selectedArtist} onClose={() => setSelectedArtist(null)} />
    </>
  );
}
