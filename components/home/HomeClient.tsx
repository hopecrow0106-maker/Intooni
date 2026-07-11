"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  FilterBar,
  type FollowerRangeKey,
  type GenreFilterItem
} from "@/components/FilterBar";
import { GoogleAd } from "@/components/GoogleAd";
import { ArtistCard } from "@/components/ArtistCard";
import { ArtistModal } from "@/components/ArtistModal";
import { InstagramEmbed } from "@/components/InstagramEmbed";
import { SearchBar } from "@/components/SearchBar";
import { ADSENSE_SLOTS } from "@/lib/adsense";
import type { PublicArtistDTO } from "@/lib/domain/public-artist";
import type { PublicMagazineDTO } from "@/lib/domain/public-magazine";
import { ARTIST_SQUARE_PLACEHOLDER, MAGAZINE_RECT_PLACEHOLDER } from "@/lib/placeholders";
import type { Artist, Category } from "@/lib/types";

const INQUIRY_MESSAGE = "jaamstudio@naver.com 로 연락주세요!";
const HERO_DELAYS = ["0s", "0.7s", "0.3s", "1s"] as const;

type HeroDecoration = {
  artist: Artist;
  duration: number;
  delay: string;
  driftX: number;
  driftY: number;
};

type GrowthMetric = "followers" | "posts";
type GrowthValueMode = "count" | "rate";
type PublicArtistsResponse = {
  artists?: PublicArtistDTO[];
};
type HomeClientProps = {
  initialArtists?: PublicArtistDTO[];
  initialCategories?: Category[];
  initialMagazines?: PublicMagazineDTO[];
};
const GROWTH_BAR_COLORS = ["#ff4d6d", "#49a7c9", "#7c6ee6", "#f0a33a", "#47a878"] as const;

function publicArtistToHomeArtist(artist: PublicArtistDTO): Artist {
  return {
    id: artist.id,
    name: artist.name,
    instagram_handle: artist.instagram_handle,
    genre: artist.category,
    followers: artist.stats.followers ?? 0,
    post_count: artist.stats.post_count ?? 0,
    weekly_follower_growth: artist.stats.followers_delta,
    weekly_post_growth: artist.stats.posts_delta,
    weekly_follower_growth_rate:
      artist.stats.followers_growth_rate === null ? null : artist.stats.followers_growth_rate * 100,
    weekly_post_growth_rate:
      artist.stats.posts_growth_rate === null ? null : artist.stats.posts_growth_rate * 100,
    stats_period_start: artist.stats.previous_recorded_date,
    stats_period_end: artist.stats.latest_recorded_date,
    stats_interval_days: artist.stats.comparison_interval_days,
    is_weekly_comparable: artist.stats.is_weekly_comparable,
    hashtags: artist.hashtags,
    search_tags: artist.search_tags,
    mood_tags: artist.mood_tags,
    style_tags: artist.style_tags,
    topic_tags: artist.topic_tags,
    internal_memo: "",
    bio: artist.bio,
    thumbnail_url: artist.thumbnail_url,
    character_url: artist.character_url,
    gallery_post_urls: artist.gallery_post_urls,
    is_trending: artist.is_trending,
    hide_from_new: artist.hide_from_new,
    sort_order: artist.sort_order,
    last_stats_updated_at:
      artist.stats.latest_recorded_date ?? artist.updated_at ?? artist.created_at,
    created_at: artist.created_at
  };
}

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    return fallback;
  }

  return (await response.json()) as T;
}

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

function formatGrowthCount(value: number) {
  return `+${new Intl.NumberFormat("ko-KR").format(Math.max(0, value))}`;
}

function formatGrowthRate(value: number) {
  return `+${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2
  }).format(Math.max(0, value))}%`;
}

function formatPeriodDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getGrowthPeriodLabel(artists: Artist[]) {
  const artistWithPeriod = artists.find((artist) => artist.stats_period_start && artist.stats_period_end);
  const start = formatPeriodDate(artistWithPeriod?.stats_period_start);
  const end = formatPeriodDate(artistWithPeriod?.stats_period_end);

  if (!start || !end) return "주간 비교 데이터 부족";
  if (artistWithPeriod?.is_weekly_comparable === false) {
    return `주간 비교 데이터 부족 · ${start} ~ ${end}`;
  }
  return `집계 기준 ${start} ~ ${end}`;
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function getFallbackInstagramUrl(artist: Artist) {
  return artist.gallery_post_urls.find((url) => url.trim()) ?? "";
}

function sortProfileFirst<T extends Artist>(artists: T[]) {
  return [...artists].sort((a, b) => {
    const aHasProfile = Boolean(a.thumbnail_url);
    const bHasProfile = Boolean(b.thumbnail_url);

    if (aHasProfile !== bHasProfile) {
      return Number(bHasProfile) - Number(aHasProfile);
    }

    return 0;
  });
}

function createRandomOrderMap(artists: Artist[]) {
  return shuffleItems(artists).reduce<Record<string, number>>((acc, artist, index) => {
    acc[artist.id] = index;
    return acc;
  }, {});
}

function createInitialOrderMap(artists: Artist[]) {
  return artists.reduce<Record<string, number>>((acc, artist, index) => {
    acc[artist.id] = index;
    return acc;
  }, {});
}

function pickInitialHeroDecorations(artists: Artist[]): HeroDecoration[] {
  return artists
    .filter((artist) => artist.character_url.trim())
    .slice(0, 4)
    .map((artist, index) => ({
      artist,
      duration: 7,
      delay: HERO_DELAYS[index] ?? "0s",
      driftX: index % 2 === 0 ? 12 : -12,
      driftY: 12
    }));
}

function pickHeroDecorations(artists: Artist[]): HeroDecoration[] {
  const selected = shuffleItems(artists.filter((artist) => artist.character_url.trim())).slice(0, 4);

  return selected.map((artist, index) => ({
    artist,
    duration: 6 + Math.random() * 3,
    delay: HERO_DELAYS[index] ?? "0s",
    driftX: (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 12),
    driftY: 8 + Math.random() * 10
  }));
}

function pickRandomArtistByGenre(artists: Artist[], genre: string) {
  const candidates = artists.filter((artist) => genre === "전체" || artist.genre === genre);
  return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

function AdSidebarPlaceholder() {
  return (
    <GoogleAd
      slot={ADSENSE_SLOTS.leftSidebar}
      label="데스크톱 왼쪽 광고"
      className="sticky top-20 min-h-[600px] w-[160px]"
      format="vertical"
      fullWidthResponsive={false}
    />
  );
}

function RightAdSidebar() {
  return (
    <GoogleAd
      slot={ADSENSE_SLOTS.rightSidebar}
      label="데스크톱 오른쪽 광고"
      className="sticky top-20 min-h-[600px] w-[160px]"
      format="vertical"
      fullWidthResponsive={false}
    />
  );
}

function SectionBannerAd() {
  return (
    <section className="mx-auto mb-12 max-w-[1200px] px-5 md:px-8">
      <GoogleAd
        slot={ADSENSE_SLOTS.sectionBanner}
        label="섹션 사이 배너 광고"
        className="min-h-[90px] w-full"
      />
    </section>
  );
}

function ArtistSkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-white">
      <div className="aspect-[4/3] animate-pulse bg-[#f2f0ec]" />
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
  onClick
}: {
  artist: Artist;
  onClick: () => void;
}) {
  const fallbackInstagramUrl = getFallbackInstagramUrl(artist);

  return (
    <button type="button" onClick={onClick} className="trending-card text-left">
      {artist.thumbnail_url ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f2f0ec]">
          <Image
            src={artist.thumbnail_url}
            alt={artist.name}
            fill
            className="object-cover"
            sizes="240px"
          />
        </div>
      ) : fallbackInstagramUrl ? (
        <div className="bg-white p-2">
          <InstagramEmbed
            url={fallbackInstagramUrl}
            className="min-h-[180px] rounded-[14px] border border-[rgba(0,0,0,0.08)]"
          />
        </div>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f2f0ec]">
          <Image
            src={ARTIST_SQUARE_PLACEHOLDER}
            alt={artist.name}
            fill
            className="object-cover"
            sizes="240px"
          />
        </div>
      )}
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
  const fallbackInstagramUrl = getFallbackInstagramUrl(artist);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white text-left transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
    >
      <span className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#1e243d] text-lg font-bold text-white">
        {index + 1}
      </span>
      {artist.thumbnail_url ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f2f0ec]">
          <Image
            src={artist.thumbnail_url}
            alt={artist.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 280px"
          />
        </div>
      ) : fallbackInstagramUrl ? (
        <div className="bg-white p-2">
          <InstagramEmbed
            url={fallbackInstagramUrl}
            className="min-h-[230px] rounded-[18px] border border-[rgba(0,0,0,0.08)]"
          />
        </div>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f2f0ec]">
          <Image
            src={ARTIST_SQUARE_PLACEHOLDER}
            alt={artist.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 280px"
          />
        </div>
      )}
      <div className="space-y-1 px-5 pb-5 pt-4">
        <p className="text-[15px] font-bold tracking-[-0.02em] text-[#1a1a1a]">{artist.name}</p>
        <p className="text-sm text-[#8a8a8a]">
          {artist.genre} · {formatFollowerCount(artist.followers)}
        </p>
      </div>
    </button>
  );
}

function getWeeklyGrowthValue(artist: Artist, metric: GrowthMetric, valueMode: GrowthValueMode) {
  if (metric === "followers") {
    return valueMode === "count"
      ? artist.weekly_follower_growth ?? 0
      : artist.weekly_follower_growth_rate ?? 0;
  }

  return valueMode === "count" ? artist.weekly_post_growth ?? 0 : artist.weekly_post_growth_rate ?? 0;
}

function GrowthChartSection({
  artists,
  metric,
  valueMode,
  onMetricChange,
  onValueModeChange,
  onArtistClick
}: {
  artists: Artist[];
  metric: GrowthMetric;
  valueMode: GrowthValueMode;
  onMetricChange: (metric: GrowthMetric) => void;
  onValueModeChange: (valueMode: GrowthValueMode) => void;
  onArtistClick: (artist: Artist) => void;
}) {
  const maxValue = Math.max(...artists.map((artist) => getWeeklyGrowthValue(artist, metric, valueMode)), 0);
  const chartMaxValue = valueMode === "rate" ? Math.max(maxValue, 100) : maxValue;
  const benchmarkPercent = valueMode === "rate" && chartMaxValue > 100 ? (100 / chartMaxValue) * 100 : null;
  const hasData = artists.length > 0 && maxValue > 0;
  const title = metric === "followers" ? "팔로워 증가 Top 5" : "게시물 증가 Top 5";
  const unitLabel = valueMode === "count" ? "증가 수" : "증가율";
  const periodLabel = getGrowthPeriodLabel(artists);

  return (
    <section className="mx-auto mb-10 max-w-[980px] px-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#1a1a1a]">
            📈 {title}
          </h2>
          <p className="mt-1 text-xs font-medium text-[#8a8a8a]">
            주간 {unitLabel} 기준 · {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["followers", "posts"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onMetricChange(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                metric === item
                  ? "bg-[#1f2233] text-white"
                  : "border border-[rgba(0,0,0,0.08)] bg-white text-[#6b6b6b] hover:border-[#ff4d6d] hover:text-[#c9153d]"
              }`}
            >
              {item === "followers" ? "팔로워" : "게시물"}
            </button>
          ))}
          {(["count", "rate"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onValueModeChange(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                valueMode === item
                  ? "bg-[#ff4d6d] text-white"
                  : "border border-[rgba(0,0,0,0.08)] bg-white text-[#6b6b6b] hover:border-[#ff4d6d] hover:text-[#c9153d]"
              }`}
            >
              {item === "count" ? "갯수" : "비율"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-white px-4 py-3 sm:px-5 sm:py-4">
        {!hasData ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[16px] bg-[#f8f7f4] px-5 text-center">
            <p className="text-sm font-extrabold text-[#1a1a1a]">주간 증가 데이터 연동 대기중</p>
            <p className="mt-1.5 break-keep text-xs leading-5 text-[#8a8a8a]">
              팔로워/게시물 증가 수와 증가율이 들어오면 이 영역에 Top 5 차트가 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {artists.map((artist, index) => {
              const value = getWeeklyGrowthValue(artist, metric, valueMode);
              const width = chartMaxValue > 0 ? Math.min(Math.max((value / chartMaxValue) * 100, 2), 100) : 0;
              const barColor = GROWTH_BAR_COLORS[index % GROWTH_BAR_COLORS.length];

              return (
                <button
                  key={artist.id}
                  type="button"
                  onClick={() => onArtistClick(artist)}
                  className="growth-row group grid w-full grid-cols-[32px_minmax(0,1fr)_72px] items-center gap-3 rounded-[10px] px-1.5 py-2 text-left transition hover:bg-[#faf7f3] sm:grid-cols-[32px_150px_minmax(220px,1fr)_86px]"
                  style={{ "--growth-delay": `${index * 75}ms` } as CSSProperties}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-white"
                    style={{ backgroundColor: barColor }}
                  >
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[8px] bg-[#f2f0ec]">
                      <Image
                        src={artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER}
                        alt={artist.name}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#1a1a1a]">{artist.name}</p>
                      <p className="truncate text-[11px] font-medium text-[#a0a0a0]">{artist.genre}</p>
                    </div>
                  </div>
                  <div className="relative order-4 col-span-3 h-2.5 rounded-full bg-[#f1eee8] sm:order-none sm:col-span-1">
                    {benchmarkPercent !== null ? (
                      <span
                        className="absolute top-[-3px] h-[18px] w-px bg-[#2d3142]/35"
                        style={{ left: `${benchmarkPercent}%` }}
                      />
                    ) : null}
                    <div
                      key={`${metric}-${valueMode}-${artist.id}`}
                      className="growth-bar-fill h-full rounded-full"
                      style={
                        {
                          "--growth-width": `${width}%`,
                          "--growth-delay": `${index * 75}ms`,
                          backgroundColor: barColor
                        } as CSSProperties
                      }
                    />
                  </div>
                  <span
                    key={`${metric}-${valueMode}-${artist.id}-value`}
                    className="growth-value-pop order-3 text-right text-sm font-extrabold text-[#1f2233] sm:order-none"
                    style={{ "--growth-delay": `${index * 75 + 120}ms` } as CSSProperties}
                  >
                    {valueMode === "count" ? formatGrowthCount(value) : formatGrowthRate(value)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function NewArtistsSection({
  artists,
  onArtistClick
}: {
  artists: Artist[];
  onArtistClick: (artist: Artist) => void;
}) {
  if (artists.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mb-12 max-w-[1200px] px-5 md:px-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#1a1a1a]">
          ✨ 새로운 인투니들!
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {artists.map((artist, index) => (
            <div
              key={artist.id}
              className="min-w-0"
            >
              <ArtistCard
                artist={artist}
                index={index}
                onClick={() => onArtistClick(artist)}
              />
            </div>
          ))}
      </div>
    </section>
  );
}

export default function HomeClient({
  initialArtists = [],
  initialCategories = [],
  initialMagazines = []
}: HomeClientProps) {
  const initialHomeArtists = useMemo(
    () => initialArtists.map(publicArtistToHomeArtist),
    [initialArtists]
  );
  const [allArtists, setAllArtists] = useState<Artist[]>(initialHomeArtists);
  const [searchArtists, setSearchArtists] = useState<Artist[] | null>(null);
  const [artistRandomOrder, setArtistRandomOrder] = useState<Record<string, number>>(() =>
    createInitialOrderMap(initialHomeArtists)
  );
  const [artistCount, setArtistCount] = useState(initialHomeArtists.length);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [genreCounts, setGenreCounts] = useState<Record<string, number>>(() =>
    initialHomeArtists.reduce<Record<string, number>>((acc, artist) => {
      acc[artist.genre] = (acc[artist.genre] ?? 0) + 1;
      return acc;
    }, {})
  );
  const [magazines, setMagazines] = useState<PublicMagazineDTO[]>(initialMagazines);
  const [heroDecorations, setHeroDecorations] = useState<HeroDecoration[]>(() =>
    pickInitialHeroDecorations(initialHomeArtists)
  );
  const [featuredHotArtists, setFeaturedHotArtists] = useState<Artist[]>(() =>
    sortProfileFirst(initialHomeArtists.filter((artist) => artist.is_trending)).slice(0, 8)
  );
  const [loading, setLoading] = useState(initialHomeArtists.length === 0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeGenres, setActiveGenres] = useState<string[]>([]);
  const [activeFollowerRanges, setActiveFollowerRanges] = useState<FollowerRangeKey[]>([]);
  const [showFollowerFilters, setShowFollowerFilters] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [randomGenre, setRandomGenre] = useState("전체");
  const [randomPickedArtist, setRandomPickedArtist] = useState<Artist | null>(null);
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [randomRolling, setRandomRolling] = useState(false);
  const [randomRollingName, setRandomRollingName] = useState("");
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [typedInquiryText, setTypedInquiryText] = useState("");
  const [growthMetric, setGrowthMetric] = useState<GrowthMetric>("followers");
  const [growthValueMode, setGrowthValueMode] = useState<GrowthValueMode>("count");
  const hasMoreArtists = false;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastLoggedSearchRef = useRef("");
  const searchResultsRef = useRef<HTMLElement | null>(null);

  const hasTextSearch = search.trim().length > 0;
  const isSearching = search.trim().length > 0 || activeGenres.length > 0 || activeFollowerRanges.length > 0;

  useEffect(() => {
    setArtistRandomOrder(createRandomOrderMap(initialHomeArtists));
    setHeroDecorations(pickHeroDecorations(initialHomeArtists));
  }, [initialHomeArtists]);

  const trackArtistEvent = (artistId: string) => {
    void fetch("/api/artist-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ artistId, eventType: "artist_click" }),
      keepalive: true
    }).catch(() => undefined);
  };

  const openArtistModal = (artist: Artist) => {
    trackArtistEvent(artist.id);
    setSelectedArtist(artist);
  };

  const startRandomPick = () => {
    const candidates = allArtists.filter((artist) => randomGenre === "전체" || artist.genre === randomGenre);
    const rollingPool = allArtists.length > 0 ? allArtists : candidates;

    if (candidates.length === 0 || randomRolling) {
      return;
    }

    setRandomPickedArtist(null);
    setRandomRolling(true);

    let ticks = 0;
    const shuffled = shuffleItems(rollingPool);
    const timer = window.setInterval(() => {
      const current = shuffled[ticks % shuffled.length];
      setRandomRollingName(current.name);
      ticks += 1;

      if (ticks >= 18) {
        window.clearInterval(timer);
        const picked = pickRandomArtistByGenre(allArtists, randomGenre);
        setRandomPickedArtist(picked);
        setRandomRollingName(picked?.name ?? "");
        setRandomRolling(false);
      }
    }, 72);
  };

  useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      setLoading(true);

      const [categoriesResponse, magazinesResponse, artistsResponse] = await Promise.all([
        fetchJson<Category[]>("/api/categories", []),
        fetchJson<PublicMagazineDTO[]>("/api/magazines", []),
        fetchJson<PublicArtistsResponse>("/api/public/artists", { artists: [] })
      ]);

      if (!mounted) {
        return;
      }

      setCategories(categoriesResponse);
      const nextArtists = (artistsResponse.artists ?? []).map(publicArtistToHomeArtist);
      const counts = nextArtists.reduce<Record<string, number>>((acc, artist) => {
        acc[artist.genre] = (acc[artist.genre] ?? 0) + 1;
        return acc;
      }, {});
      setGenreCounts(counts);
      setMagazines(magazinesResponse);

      setAllArtists(nextArtists);
      setArtistCount(nextArtists.length);
      setArtistRandomOrder(createRandomOrderMap(nextArtists));
      setHeroDecorations(pickHeroDecorations(nextArtists));

      const hotArtists = sortProfileFirst(nextArtists.filter((artist) => artist.is_trending)).slice(0, 8);
      setFeaturedHotArtists(hotArtists);

      setLoading(false);
    };

    void fetchInitialData();

    return () => {
      mounted = false;
    };
  }, []);

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
    if (!isSearching) {
      setSearchArtists(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      setSearchArtists(allArtists);
      setSearchLoading(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [allArtists, isSearching]);

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

  const featuredMagazines = useMemo(() => magazines.slice(0, 4), [magazines]);
  const randomGenreItems = useMemo(() => ["전체", ...categories.map((category) => category.name)], [categories]);

  const searchExamples = useMemo(() => {
    const tags = allArtists.flatMap((artist) => [...artist.hashtags, ...artist.search_tags]);
    return [...new Set(tags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean))];
  }, [allArtists]);

  const filteredMagazines = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return magazines.filter((magazine) => {
      return (
        magazine.title.toLowerCase().includes(query) ||
        magazine.tag.toLowerCase().includes(query) ||
        magazine.content.toLowerCase().includes(query)
      );
    });
  }, [magazines, search]);

  const featuredNewArtists = useMemo(
    () =>
      sortProfileFirst(
        [...allArtists]
          .filter((artist) => !artist.hide_from_new)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 4)
      ),
    [allArtists]
  );
  const featuredWeeklyGrowthArtists = useMemo(() => {
    const sortedByGrowth = allArtists.filter((artist) => artist.is_weekly_comparable !== false).sort((a, b) => {
      const aGrowth = getWeeklyGrowthValue(a, growthMetric, growthValueMode);
      const bGrowth = getWeeklyGrowthValue(b, growthMetric, growthValueMode);

      if (aGrowth !== bGrowth) {
        return bGrowth - aGrowth;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return sortedByGrowth
      .filter((artist) => getWeeklyGrowthValue(artist, growthMetric, growthValueMode) > 0)
      .slice(0, 5);
  }, [allArtists, growthMetric, growthValueMode]);
  const featuredHotProfileArtists = useMemo(
    () => featuredHotArtists.filter((artist) => artist.thumbnail_url),
    [featuredHotArtists]
  );
  const featuredHotEmbedArtists = useMemo(
    () => featuredHotArtists.filter((artist) => !artist.thumbnail_url && getFallbackInstagramUrl(artist)),
    [featuredHotArtists]
  );

  const filteredArtists = useMemo(() => {
    const baseArtists = isSearching ? searchArtists ?? [] : allArtists;
    const query = search.trim().toLowerCase();

    return [...baseArtists]
      .sort((a, b) => (artistRandomOrder[a.id] ?? 0) - (artistRandomOrder[b.id] ?? 0))
      .filter((artist) => {
        const visibleTags = artist.hashtags.map((tag) => tag.toLowerCase());
        const searchTags = artist.search_tags.map((tag) => tag.toLowerCase());
        const bio = artist.bio.toLowerCase();

        const matchSearch =
          !query ||
          artist.name.toLowerCase().includes(query) ||
          visibleTags.some((tag) => tag.includes(query)) ||
          searchTags.some((tag) => tag.includes(query)) ||
          bio.includes(query);

        const matchGenre = activeGenres.length === 0 || activeGenres.includes(artist.genre);
        const matchFollower =
          activeFollowerRanges.length === 0 ||
          activeFollowerRanges.some((range) => matchesFollowerRange(artist.followers, range));

        return matchSearch && matchGenre && matchFollower;
      });
  }, [activeFollowerRanges, activeGenres, allArtists, artistRandomOrder, isSearching, search, searchArtists]);

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

  useEffect(() => {
    if (!hasTextSearch || loading || searchLoading) {
      return;
    }

    const timer = window.setTimeout(() => {
      searchResultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [hasTextSearch, loading, searchLoading, visibleArtists.length, filteredMagazines.length]);

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

  const visibleCountLabel = hasTextSearch
    ? filteredArtists.length + filteredMagazines.length
    : isSearching
      ? filteredArtists.length
      : artistCount;
  const showLoadingState = loading || searchLoading;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[rgba(0,0,0,0.07)] bg-[rgba(248,247,244,0.93)] px-4 py-2 backdrop-blur-md md:flex md:h-[60px] md:items-center md:gap-5 md:px-8 md:py-0">
        <div className="flex items-center gap-3 md:contents">
        <a
          href="/"
          className="shrink-0 font-moyamoya text-[22px] tracking-[-0.04em] text-[#ff4d6d]"
        >
          인투<span className="text-[#1a1a1a]">니</span>
        </a>
        <SearchBar value={search} onChange={setSearch} examples={searchExamples} />
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => {
              setShowRandomModal(true);
              setRandomPickedArtist(null);
              setRandomRollingName("");
            }}
            aria-label="랜덤 인투니 찾기"
            className="rounded-full bg-[#55bfe8] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(74,171,211,0.28)] transition hover:-translate-y-0.5 hover:bg-[#38addd]"
          >
            랜덤 인투니 찾기
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRandomModal(true);
              setRandomPickedArtist(null);
              setRandomRollingName("");
            }}
            className="relative hidden rounded-full border border-[#55bfe8] bg-white px-3 py-2 text-xs font-bold text-[#24728d] shadow-[0_10px_26px_rgba(74,171,211,0.18)] transition hover:-translate-y-0.5 hover:border-[#38addd] hover:text-[#1c6078] lg:inline-flex"
          >
            <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-l border-[#55bfe8] bg-white" />
            뭐 볼거 없나..?
          </button>
          <Link
            href="/toonbti"
            aria-label="툰비티아이 테스트하러 가기"
            className="rounded-full bg-[#ff4d6d] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,77,109,0.18)] transition hover:bg-[#e83a5a]"
          >
            나랑 맞는 작가는?
          </Link>
          <Link
            href="/toonbti"
            className="relative hidden rounded-full border border-[#ffd6df] bg-white px-3 py-2 text-xs font-bold text-[#ff4d6d] shadow-[0_10px_26px_rgba(255,77,109,0.12)] transition hover:-translate-y-0.5 hover:border-[#ff4d6d] lg:inline-flex"
          >
            <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-l border-[#ffd6df] bg-white" />
            지금 바로 테스트하러 고고!
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
          <Link
            href="/toonbti"
            className="flex items-center justify-center rounded-[16px] bg-[#ff4d6d] px-3 py-3 text-center text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(255,77,109,0.22)]"
          >
            나랑 맞는 작가는?
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowRandomModal(true);
              setRandomPickedArtist(null);
              setRandomRollingName("");
            }}
            className="flex items-center justify-center rounded-[16px] bg-[#55bfe8] px-3 py-3 text-center text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(74,171,211,0.24)]"
          >
            랜덤 인투니 찾기!
          </button>
        </div>
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
              <button
                type="button"
                onClick={() => openArtistModal(heroDecorations[1].artist)}
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
              </button>
            )}

            {/* ② 왼쪽 안쪽 · 아래 (큰) — 왼쪽에서 10% 안으로 */}
            {heroDecorations[0] && (
              <button
                type="button"
                onClick={() => openArtistModal(heroDecorations[0].artist)}
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
              </button>
            )}

            {/* ③ 오른쪽 안쪽 · 위 (큰) — 오른쪽에서 10% 안으로 */}
            {heroDecorations[2] && (
              <button
                type="button"
                onClick={() => openArtistModal(heroDecorations[2].artist)}
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
              </button>
            )}

            {/* ④ 오른쪽 끝 · 아래 (작은, md+) */}
            {heroDecorations[3] && (
              <button
                type="button"
                onClick={() => openArtistModal(heroDecorations[3].artist)}
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
              </button>
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

          <div className="mx-auto mb-8 max-w-[1200px] px-5 md:px-8">
            <a
              href="https://forms.gle/1urGhUvYyJfGjY2H7"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-3 rounded-[16px] bg-[#ff4d6d] px-4 py-3 text-white shadow-[0_10px_24px_rgba(255,77,109,0.18)] transition hover:-translate-y-0.5 hover:bg-[#e83a5a] sm:px-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base text-[#ff4d6d]">
                📝
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-keep text-sm font-extrabold tracking-[-0.02em] text-white">
                  인스타툰 작가라면, 인투니 등록 신청
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#c9153d]">
                신청 →
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              {featuredHotProfileArtists.length > 0 ? (
                <div className="trending-row">
                  {featuredHotProfileArtists.map((artist) => (
                    <HorizontalArtistCard
                      key={artist.id}
                      artist={artist}
                      onClick={() => openArtistModal(artist)}
                    />
                  ))}
                </div>
              ) : null}
              {featuredHotEmbedArtists.length > 0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {featuredHotEmbedArtists.map((artist, index) => (
                    <NewArtistGridCard
                      key={artist.id}
                      artist={artist}
                      index={featuredHotProfileArtists.length + index}
                      onClick={() => openArtistModal(artist)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {!isSearching ? (
            <GrowthChartSection
              artists={featuredWeeklyGrowthArtists}
              metric={growthMetric}
              valueMode={growthValueMode}
              onMetricChange={setGrowthMetric}
              onValueModeChange={setGrowthValueMode}
              onArtistClick={(artist) => openArtistModal(artist)}
            />
          ) : null}

          {!isSearching ? (
            <NewArtistsSection
              artists={featuredNewArtists}
              onArtistClick={(artist) => openArtistModal(artist)}
            />
          ) : null}

          {!isSearching && featuredNewArtists.length > 0 ? <SectionBannerAd /> : null}

          <section ref={searchResultsRef} className="mx-auto max-w-[1200px] px-5 pb-20 md:px-8">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#1a1a1a]">
                {gridTitle}
              </h2>
              {!showLoadingState ? (
                <span className="text-sm text-[#a0a0a0]">총 {visibleCountLabel}명</span>
              ) : null}
            </div>

            {showLoadingState ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: 8 }).map((_, index) => (
                  <ArtistSkeletonCard key={index} />
                ))}
              </div>
            ) : filteredArtists.length === 0 && (!hasTextSearch || filteredMagazines.length === 0) ? (
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
                {hasTextSearch && filteredMagazines.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold tracking-[-0.02em] text-[#1a1a1a]">
                        매거진
                      </h3>
                      <span className="text-sm text-[#a0a0a0]">{filteredMagazines.length}개</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {filteredMagazines.map((magazine) => (
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
                              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
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
                  </div>
                ) : null}

                {regularVisibleArtists.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                    {regularVisibleArtists.map((artist, index) => (
                      <ArtistCard
                        key={artist.id}
                        artist={artist}
                        index={index}
                        onClick={() => openArtistModal(artist)}
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
                          onClick={() => openArtistModal(artist)}
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
          </section>
        </div>

        <aside className="hidden xl:block">
          <RightAdSidebar />
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

      {showRandomModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(10,20,28,0.42)] px-5"
          onClick={() => {
            if (!randomRolling) {
              setShowRandomModal(false);
            }
          }}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[32px] border border-[#c9efff] bg-white shadow-[0_28px_90px_rgba(36,114,141,0.22)] md:max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-[#e5f8ff] via-white to-[#fff7f8] px-6 py-7">
              <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#c9efff]/70" />
              <div className="pointer-events-none absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-[#fff0f3]" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#24728d]">Random Intooni</p>
                  <h3 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#1a1a1a]">
                    랜덤 인투니 찾기
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">
                    카테고리를 고르면 차르르륵 돌려서 오늘 볼 작가를 뽑아드려요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRandomModal(false)}
                  disabled={randomRolling}
                  className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#6b6b6b] shadow-sm disabled:opacity-50"
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 md:grid md:grid-cols-[1fr_280px] md:gap-6 md:space-y-0 md:px-6 md:py-6">
              <div>
                <p className="mb-3 text-sm font-bold text-[#1a1a1a]">어떤 카테고리에서 찾을까요?</p>
                <div className="flex flex-wrap gap-2">
                  {randomGenreItems.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        setRandomGenre(genre);
                        setRandomPickedArtist(null);
                        setRandomRollingName("");
                      }}
                      disabled={randomRolling}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                        randomGenre === genre
                          ? "border-[#8edcff] bg-[#dff5ff] text-[#24728d] shadow-[0_10px_22px_rgba(74,171,211,0.16)]"
                          : "border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] text-[#6b6b6b] hover:border-[#8edcff] hover:text-[#24728d]"
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-[#dff5ff] bg-[#f7fcff] px-4 py-4 text-center md:row-span-2 md:px-5 md:py-5">
                {randomPickedArtist && !randomRolling ? (
                  <div className="mx-auto mb-3 w-full max-w-[150px] overflow-hidden rounded-[20px] border border-[#dff5ff] bg-white shadow-[0_16px_32px_rgba(36,114,141,0.12)] sm:max-w-[190px] md:mb-4 md:max-w-[240px] md:rounded-[24px]">
                    {randomPickedArtist.thumbnail_url ? (
                      <div className="relative aspect-square bg-[#f2f0ec]">
                        <Image
                          src={randomPickedArtist.thumbnail_url}
                          alt={randomPickedArtist.name}
                          fill
                          className="object-cover"
                          sizes="220px"
                        />
                      </div>
                    ) : getFallbackInstagramUrl(randomPickedArtist) ? (
                      <div className="p-2">
                        <InstagramEmbed
                          url={getFallbackInstagramUrl(randomPickedArtist)}
                          compact
                          className="max-h-[170px] min-h-[120px] rounded-[16px] border border-[rgba(0,0,0,0.08)] md:max-h-none md:min-h-[220px] md:rounded-[18px]"
                        />
                      </div>
                    ) : (
                      <div className="relative aspect-square bg-[#f2f0ec]">
                        <Image
                          src={ARTIST_SQUARE_PLACEHOLDER}
                          alt={randomPickedArtist.name}
                          fill
                          className="object-cover"
                          sizes="220px"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-[0_16px_32px_rgba(36,114,141,0.12)]">
                    🎲
                  </div>
                )}
                <div className="relative mx-auto flex h-16 max-w-sm items-center justify-center overflow-hidden rounded-2xl bg-white px-4 shadow-inner">
                  <p
                    className={`text-2xl font-extrabold tracking-[-0.04em] text-[#24728d] ${
                      randomRolling ? "animate-pulse" : ""
                    }`}
                  >
                    {randomRollingName || randomPickedArtist?.name || "누가 나올까요?"}
                  </p>
                </div>
                <p className="mt-2 text-xs font-semibold text-[#8a8a8a] md:mt-3">
                  {randomRolling
                    ? "차르르르륵... 고르는 중"
                    : randomPickedArtist
                      ? `${randomGenre}에서 발견한 오늘의 인투니`
                      : "버튼을 누르면 랜덤 추천이 시작돼요"}
                </p>
              </div>

              <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-2 self-end border-t border-[#dff5ff] bg-white/95 px-5 py-3 backdrop-blur sm:flex-row md:static md:col-start-1 md:mx-0 md:border-t-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0">
                <button
                  type="button"
                  onClick={startRandomPick}
                  disabled={randomRolling || allArtists.length === 0}
                  className="flex-1 rounded-full bg-[#74ccef] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(74,171,211,0.24)] transition hover:bg-[#51bce5] disabled:cursor-not-allowed disabled:bg-[#d8d6d2]"
                >
                  {randomRolling ? "돌리는 중..." : "차르르륵 돌리기"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!randomPickedArtist) {
                      return;
                    }
                    setShowRandomModal(false);
                    openArtistModal(randomPickedArtist);
                  }}
                  disabled={!randomPickedArtist || randomRolling}
                  className="flex-1 rounded-full border border-[#c9efff] bg-white px-5 py-3 text-sm font-extrabold text-[#24728d] transition hover:border-[#74ccef] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  추천 작가 보기
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ArtistModal artist={selectedArtist} onClose={() => setSelectedArtist(null)} />
    </>
  );
}
