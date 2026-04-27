"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ArtistForm, type ArtistFormValues } from "@/components/admin/ArtistForm";
import { ArtistTable } from "@/components/admin/ArtistTable";
import { MagazineForm, type MagazineFormValues } from "@/components/admin/MagazineForm";
import { MagazineTable } from "@/components/admin/MagazineTable";
import {
  type ArtistStatsPeriod,
  type ArtistStatsSummary
} from "@/lib/artist-events";
import type { Artist, Category, Magazine } from "@/lib/types";

type DebugError = {
  action: string;
  source: string;
  endpoint?: string;
  message: string;
};

type AdminTab = "artists" | "magazines";

type SearchQuerySummary = {
  query: string;
  count: number;
  latest_at: string;
};

type ArtistChartItem = {
  id: string;
  name: string;
  total: number;
  profile_click: number;
  instagram_click: number;
  embed_click: number;
  hero_click: number;
};

type MagazineChartItem = {
  id: string;
  title: string;
  views: number;
};

async function requestArtistStats(period: ArtistStatsPeriod) {
  const response = await fetch(`/api/artist-events?period=${period}`, { cache: "no-store" });
  const data = (await response.json()) as { stats?: ArtistStatsSummary[]; message?: string };

  if (!response.ok) {
    return {
      data: [] as ArtistStatsSummary[],
      error: {
        action: "작가 통계 조회",
        source: "app/admin/page.tsx > requestArtistStats",
        endpoint: "/api/artist-events",
        message: data.message ?? "작가 통계를 불러오지 못했습니다."
      } satisfies DebugError
    };
  }

  return {
    data: Array.isArray(data.stats) ? data.stats : [],
    error: null as DebugError | null
  };
}

async function requestArtists() {
  const response = await fetch("/api/artists", { cache: "no-store" });
  const data = (await response.json()) as Artist[] | { message?: string };

  if (!response.ok) {
    return {
      data: [] as Artist[],
      error: {
        action: "작가 목록 조회",
        source: "app/admin/page.tsx > requestArtists",
        endpoint: "/api/artists",
        message: (data as { message?: string }).message ?? "작가 목록을 불러오지 못했습니다."
      } satisfies DebugError
    };
  }

  return { data: data as Artist[], error: null as DebugError | null };
}

async function requestSearchQueries(period: ArtistStatsPeriod) {
  const response = await fetch(`/api/search-queries?period=${period}`, { cache: "no-store" });
  const data = (await response.json()) as {
    queries?: SearchQuerySummary[];
    message?: string;
  };

  if (!response.ok) {
    return {
      data: [] as SearchQuerySummary[],
      error: {
        action: "검색어 통계 조회",
        source: "app/admin/page.tsx > requestSearchQueries",
        endpoint: "/api/search-queries",
        message: data.message ?? "검색어 통계를 불러오지 못했습니다."
      } satisfies DebugError
    };
  }

  return {
    data: Array.isArray(data.queries) ? data.queries : [],
    error: null as DebugError | null
  };
}

async function requestCategories() {
  const response = await fetch("/api/categories", { cache: "no-store" });
  const data = (await response.json()) as Category[] | { message?: string };

  if (!response.ok) {
    return {
      data: [] as Category[],
      error: {
        action: "카테고리 목록 조회",
        source: "app/admin/page.tsx > requestCategories",
        endpoint: "/api/categories",
        message:
          (data as { message?: string }).message ?? "카테고리 목록을 불러오지 못했습니다."
      } satisfies DebugError
    };
  }

  return { data: data as Category[], error: null as DebugError | null };
}

async function requestMagazines() {
  const response = await fetch("/api/magazines", { cache: "no-store" });
  const data = (await response.json()) as Magazine[] | { message?: string };

  if (!response.ok) {
    return {
      data: [] as Magazine[],
      error: {
        action: "매거진 목록 조회",
        source: "app/admin/page.tsx > requestMagazines",
        endpoint: "/api/magazines",
        message: (data as { message?: string }).message ?? "매거진 목록을 불러오지 못했습니다."
      } satisfies DebugError
    };
  }

  return { data: data as Magazine[], error: null as DebugError | null };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function getStatsPeriodLabel(period: ArtistStatsPeriod) {
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

function StatsCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="panel-surface p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-400">{helper}</p> : null}
    </div>
  );
}

function ArtistStatsChart({
  items,
  period
}: {
  items: ArtistChartItem[];
  period: ArtistStatsPeriod;
}) {
  const maxTotal = Math.max(...items.map((item) => item.total), 1);

  return (
    <div className="panel-surface p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-coral">Artist Stats</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
            {getStatsPeriodLabel(period)} 기준 상위 작가 반응
          </h3>
        </div>
        <p className="text-sm text-slate-500">카드 클릭 + 인스타 이동 + 임베드 이동 + 캐릭터 클릭</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          아직 집계된 작가 통계가 없습니다.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <p className="min-w-0 truncate font-semibold text-ink">{item.name}</p>
                <p className="shrink-0 font-medium text-slate-500">
                  총 {formatNumber(item.total)}
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="flex h-full overflow-hidden rounded-full"
                  style={{ width: `${Math.max((item.total / maxTotal) * 100, 6)}%` }}
                >
                  {item.profile_click > 0 ? (
                    <div
                      className="bg-[#6d5efc]"
                      style={{ width: `${(item.profile_click / item.total) * 100}%` }}
                    />
                  ) : null}
                  {item.instagram_click > 0 ? (
                    <div
                      className="bg-[#ff6f91]"
                      style={{ width: `${(item.instagram_click / item.total) * 100}%` }}
                    />
                  ) : null}
                  {item.embed_click > 0 ? (
                    <div
                      className="bg-[#59b4ff]"
                      style={{ width: `${(item.embed_click / item.total) * 100}%` }}
                    />
                  ) : null}
                  {item.hero_click > 0 ? (
                    <div
                      className="bg-[#ffbf47]"
                      style={{ width: `${(item.hero_click / item.total) * 100}%` }}
                    />
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[#f4f0ff] px-2.5 py-1 text-[#5a43d6]">
                  카드 {formatNumber(item.profile_click)}
                </span>
                <span className="rounded-full bg-[#fff0f3] px-2.5 py-1 text-[#c9153d]">
                  인스타 {formatNumber(item.instagram_click)}
                </span>
                <span className="rounded-full bg-[#eef7ff] px-2.5 py-1 text-[#2b6cb0]">
                  임베드 {formatNumber(item.embed_click)}
                </span>
                <span className="rounded-full bg-[#fff8e1] px-2.5 py-1 text-[#946200]">
                  캐릭터 {formatNumber(item.hero_click)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MagazineViewsChart({ items }: { items: MagazineChartItem[] }) {
  const maxViews = Math.max(...items.map((item) => item.views), 1);

  return (
    <div className="panel-surface p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-coral">Magazine Views</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
            매거진 조회수 차트
          </h3>
        </div>
        <p className="text-sm text-slate-500">공개 페이지에서는 숨기고 관리자에서만 확인합니다.</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          등록된 매거진이 아직 없습니다.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <p className="min-w-0 truncate font-semibold text-ink">{item.title}</p>
                <p className="shrink-0 font-medium text-slate-500">
                  조회수 {formatNumber(item.views)}
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ff7a6c] to-[#ff4d6d]"
                  style={{ width: `${Math.max((item.views / maxViews) * 100, 6)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("artists");
  const [authenticated, setAuthenticated] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [artistFormOpen, setArtistFormOpen] = useState(false);
  const [magazineFormOpen, setMagazineFormOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedMagazine, setSelectedMagazine] = useState<Magazine | null>(null);
  const [debugErrors, setDebugErrors] = useState<DebugError[]>([]);
  const [artistStats, setArtistStats] = useState<Record<string, ArtistStatsSummary>>({});
  const [searchQueries, setSearchQueries] = useState<SearchQuerySummary[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<ArtistStatsPeriod>("all");
  const [artistSearch, setArtistSearch] = useState("");
  const [showAllArtistStats, setShowAllArtistStats] = useState(false);
  const [showAllSearchQueries, setShowAllSearchQueries] = useState(false);

  const isDevelopment = process.env.NODE_ENV !== "production";

  const replaceDebugErrors = (...errors: Array<DebugError | null>) => {
    setDebugErrors(errors.filter(Boolean) as DebugError[]);
  };

  const pushDebugError = (error: DebugError) => {
    setDebugErrors((current) => [...current.slice(-4), error]);
  };

  const clearDebugErrors = () => {
    setDebugErrors([]);
  };

  const fetchArtists = useCallback(async () => {
    const result = await requestArtists();
    setArtists(result.data);
    return result.error;
  }, []);

  const fetchCategories = useCallback(async () => {
    const result = await requestCategories();
    setCategories(result.data);
    return result.error;
  }, []);

  const fetchMagazines = useCallback(async () => {
    const result = await requestMagazines();
    setMagazines(result.data);
    return result.error;
  }, []);

  const fetchArtistStats = useCallback(async (period: ArtistStatsPeriod) => {
    const result = await requestArtistStats(period);
    setArtistStats(
      result.data.reduce<Record<string, ArtistStatsSummary>>((acc, item) => {
        acc[item.artist_id] = item;
        return acc;
      }, {})
    );
    return result.error;
  }, []);

  const fetchSearchQueries = useCallback(async (period: ArtistStatsPeriod) => {
    const result = await requestSearchQueries(period);
    setSearchQueries(result.data);
    return result.error;
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = (await response.json()) as { authenticated?: boolean };

      if (!data.authenticated) {
        router.replace("/admin/login");
        return;
      }

      if (!mounted) {
        return;
      }

      setAuthenticated(true);

      const [artistsError, categoriesError, magazinesError, statsError, searchQueryError] =
        await Promise.all([
        fetchArtists(),
        fetchCategories(),
        fetchMagazines(),
        fetchArtistStats("all"),
        fetchSearchQueries("all")
      ]);

      if (!mounted) {
        return;
      }

      replaceDebugErrors(
        artistsError,
        categoriesError,
        magazinesError,
        statsError,
        searchQueryError
      );
      setLoading(false);
    };

    void initialize();

    return () => {
      mounted = false;
    };
  }, [fetchArtistStats, fetchArtists, fetchCategories, fetchMagazines, fetchSearchQueries, router]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void fetchArtistStats(statsPeriod).then((error) => {
      if (error) {
        pushDebugError(error);
        return;
      }

      setDebugErrors((current) =>
        current.filter((item) => item.endpoint !== "/api/artist-events")
      );
    });
    void fetchSearchQueries(statsPeriod).then((error) => {
      if (error) {
        pushDebugError(error);
        return;
      }

      setDebugErrors((current) =>
        current.filter((item) => item.endpoint !== "/api/search-queries")
      );
    });
  }, [authenticated, fetchArtistStats, fetchSearchQueries, statsPeriod]);

  const persistArtist = async (payload: ArtistFormValues) => {
    setSaving(true);
    try {
      const method = payload.id ? "PUT" : "POST";
      const response = await fetch("/api/artists", {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        pushDebugError({
          action: payload.id ? "작가 수정" : "작가 추가",
          source: "app/admin/page.tsx > persistArtist",
          endpoint: "/api/artists",
          message: data.message ?? "저장에 실패했습니다."
        });
        return;
      }

      clearDebugErrors();
      await Promise.all([fetchArtists(), fetchArtistStats(statsPeriod)]);
      setArtistFormOpen(false);
      setSelectedArtist(null);
    } finally {
      setSaving(false);
    }
  };

  const persistMagazine = async (payload: MagazineFormValues) => {
    setSaving(true);
    try {
      const method = payload.id ? "PUT" : "POST";
      const response = await fetch("/api/magazines", {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        pushDebugError({
          action: payload.id ? "매거진 수정" : "매거진 추가",
          source: "app/admin/page.tsx > persistMagazine",
          endpoint: "/api/magazines",
          message: data.message ?? "매거진 저장에 실패했습니다."
        });
        return;
      }

      clearDebugErrors();
      await fetchMagazines();
      setMagazineFormOpen(false);
      setSelectedMagazine(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteArtist = async (artist: Artist) => {
    const confirmed = window.confirm(`${artist.name} 작가를 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/artists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: artist.id })
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        pushDebugError({
          action: "작가 삭제",
          source: "app/admin/page.tsx > deleteArtist",
          endpoint: "/api/artists",
          message: data.message ?? "삭제에 실패했습니다."
        });
        return;
      }

      clearDebugErrors();
      await Promise.all([fetchArtists(), fetchArtistStats(statsPeriod)]);
    } finally {
      setSaving(false);
    }
  };

  const deleteMagazine = async (magazine: Magazine) => {
    const confirmed = window.confirm(`${magazine.title} 매거진을 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/magazines", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: magazine.id })
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        pushDebugError({
          action: "매거진 삭제",
          source: "app/admin/page.tsx > deleteMagazine",
          endpoint: "/api/magazines",
          message: data.message ?? "매거진 삭제에 실패했습니다."
        });
        return;
      }

      clearDebugErrors();
      await fetchMagazines();
    } finally {
      setSaving(false);
    }
  };

  const toggleAd = async (artist: Artist) => {
    setSaving(true);
    try {
      const response = await fetch("/api/artists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...artist,
          is_ad: !artist.is_ad
        })
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        pushDebugError({
          action: "AD 상태 변경",
          source: "app/admin/page.tsx > toggleAd",
          endpoint: "/api/artists",
          message: data.message ?? "AD 상태 변경에 실패했습니다."
        });
        return;
      }

      clearDebugErrors();
      await fetchArtists();
    } finally {
      setSaving(false);
    }
  };

  const toggleHot = async (artist: Artist) => {
    setSaving(true);
    try {
      const response = await fetch("/api/artists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...artist,
          is_hot: !artist.is_hot
        })
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        pushDebugError({
          action: "요즘 뜨는 작가 상태 변경",
          source: "app/admin/page.tsx > toggleHot",
          endpoint: "/api/artists",
          message: data.message ?? "요즘 뜨는 작가 상태 변경에 실패했습니다."
        });
        return;
      }

      clearDebugErrors();
      await fetchArtists();
    } finally {
      setSaving(false);
    }
  };

  const reorderArtists = async (nextArtists: Artist[]) => {
    setArtists(nextArtists);
    setSaving(true);
    try {
      const response = await fetch("/api/artists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reorder",
          artists: nextArtists.map((artist, index) => ({
            id: artist.id,
            sort_order: index
          }))
        })
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        pushDebugError({
          action: "작가 순서 변경",
          source: "app/admin/page.tsx > reorderArtists",
          endpoint: "/api/artists",
          message: data.message ?? "순서 저장에 실패했습니다."
        });
        return;
      }

      clearDebugErrors();
      await fetchArtists();
    } finally {
      setSaving(false);
    }
  };

  const sortedArtists = useMemo(
    () =>
      [...artists].sort((a, b) => {
        if (a.is_ad !== b.is_ad) {
          return Number(b.is_ad) - Number(a.is_ad);
        }
        return a.sort_order - b.sort_order;
      }),
    [artists]
  );

  const filteredSortedArtists = useMemo(() => {
    const query = artistSearch.trim().toLowerCase();

    if (!query) {
      return sortedArtists;
    }

    return sortedArtists.filter((artist) => {
      const searchable = [
        artist.name,
        artist.instagram_handle,
        artist.genre,
        artist.memo,
        artist.bio,
        ...artist.hashtags,
        ...artist.hidden_tags
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [artistSearch, sortedArtists]);

  const sortedMagazines = useMemo(
    () =>
      [...magazines].sort(
        (a, b) =>
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      ),
    [magazines]
  );

  const allArtistChartItems = useMemo<ArtistChartItem[]>(() => {
    return sortedArtists
      .map((artist) => {
        const stats = artistStats[artist.id];
        if (!stats) {
          return {
            id: artist.id,
            name: artist.name,
            total: 0,
            profile_click: 0,
            instagram_click: 0,
            embed_click: 0,
            hero_click: 0
          };
        }

        const total =
          stats.profile_click +
          stats.instagram_click +
          stats.embed_click +
          stats.hero_click;

        return {
          id: artist.id,
          name: artist.name,
          total,
          profile_click: stats.profile_click,
          instagram_click: stats.instagram_click,
          embed_click: stats.embed_click,
          hero_click: stats.hero_click
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [artistStats, sortedArtists]);

  const artistChartItems = useMemo(
    () => allArtistChartItems.slice(0, showAllArtistStats ? allArtistChartItems.length : 8),
    [allArtistChartItems, showAllArtistStats]
  );

  const totalArtistInteractions = useMemo(
    () => allArtistChartItems.reduce((sum, item) => sum + item.total, 0),
    [allArtistChartItems]
  );

  const topSearchQueries = useMemo(
    () => searchQueries.slice(0, showAllSearchQueries ? searchQueries.length : 10),
    [searchQueries, showAllSearchQueries]
  );

  const magazineChartItems = useMemo<MagazineChartItem[]>(
    () =>
      sortedMagazines
        .map((magazine) => ({
          id: magazine.id,
          title: magazine.title,
          views: magazine.view_count
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8),
    [sortedMagazines]
  );

  const totalMagazineViews = useMemo(
    () => magazines.reduce((sum, magazine) => sum + magazine.view_count, 0),
    [magazines]
  );

  const topMagazine = useMemo(
    () =>
      [...magazines].sort((a, b) => b.view_count - a.view_count)[0] ?? null,
    [magazines]
  );

  if (!authenticated) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <section className="panel-surface px-6 py-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-coral">Intooni Control Room</p>
            <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold text-ink">
              관리자 사이트
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              작가와 매거진, 조회수 통계까지 한 화면에서 관리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              router.replace("/admin/login");
              router.refresh();
            }}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
          >
            로그아웃
          </button>
        </div>
      </section>

      <section className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("artists")}
          className={`pill-button ${activeTab === "artists" ? "pill-button-active" : ""}`}
        >
          작가 관리
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("magazines")}
          className={`pill-button ${activeTab === "magazines" ? "pill-button-active" : ""}`}
        >
          매거진 관리
        </button>
      </section>

      {activeTab === "artists" ? (
        <>
          <section className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
            {([
              ["all", "전체"],
              ["year", "1년"],
              ["week", "7일"],
              ["day", "오늘"]
            ] as const).map(([period, label]) => (
              <button
                key={period}
                type="button"
                onClick={() => setStatsPeriod(period)}
                className={`pill-button ${statsPeriod === period ? "pill-button-active" : ""}`}
              >
                {label} 통계
              </button>
            ))}
            </div>

            <div className="max-w-md">
              <input
                value={artistSearch}
                onChange={(event) => setArtistSearch(event.target.value)}
                placeholder="작가명, 인스타 계정, 카테고리, 태그로 검색"
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink"
              />
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              label="전체 작가"
              value={formatNumber(filteredSortedArtists.length)}
              helper={
                artistSearch.trim()
                  ? `전체 ${formatNumber(sortedArtists.length)}명 중 검색 결과`
                  : undefined
              }
            />
            <StatsCard
              label={`${getStatsPeriodLabel(statsPeriod)} 총 반응`}
              value={formatNumber(totalArtistInteractions)}
              helper="카드 클릭, 인스타 이동, 임베드 이동, 캐릭터 클릭 합산"
            />
            <StatsCard
              label="광고 노출 작가"
              value={formatNumber(sortedArtists.filter((artist) => artist.is_ad).length)}
            />
            <StatsCard
              label="카테고리 수"
              value={formatNumber(categories.length)}
            />
          </section>

          <section className="mt-6">
            <ArtistStatsChart items={artistChartItems} period={statsPeriod} />
            {allArtistChartItems.length > 8 ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAllArtistStats((current) => !current)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                >
                  {showAllArtistStats ? "접기" : "펼쳐보기"}
                </button>
              </div>
            ) : null}
          </section>

          <section className="mt-6 panel-surface p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-coral">Search Keywords</p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                  사람들이 찾은 검색어
                </h3>
              </div>
              <p className="text-sm text-slate-500">
                {getStatsPeriodLabel(statsPeriod)} 기준 상위 검색어
              </p>
            </div>

            {topSearchQueries.length === 0 ? (
              <div className="mt-5 rounded-3xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                아직 기록된 검색어가 없습니다.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {topSearchQueries.map((item, index) => (
                  <div
                    key={`${item.query}-${index}`}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{item.query}</p>
                      <p className="text-xs text-slate-400">
                        최근 검색 {new Intl.DateTimeFormat("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        }).format(new Date(item.latest_at))}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                      {formatNumber(item.count)}회
                    </span>
                  </div>
                ))}
              </div>
            )}

            {searchQueries.length > 10 ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAllSearchQueries((current) => !current)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                >
                  {showAllSearchQueries ? "접기" : "펼쳐보기"}
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard label="전체 매거진" value={formatNumber(sortedMagazines.length)} />
            <StatsCard
              label="누적 조회수"
              value={formatNumber(totalMagazineViews)}
              helper="공개 페이지에서는 보이지 않고 관리자에서만 확인합니다."
            />
            <StatsCard
              label="최고 조회 매거진"
              value={topMagazine ? topMagazine.title : "-"}
              helper={
                topMagazine ? `조회수 ${formatNumber(topMagazine.view_count)}` : "아직 데이터 없음"
              }
            />
            <StatsCard
              label="이번 달 게시"
              value={formatNumber(
                sortedMagazines.filter((magazine) => {
                  const published = new Date(magazine.published_at);
                  const now = new Date();
                  return (
                    published.getFullYear() === now.getFullYear() &&
                    published.getMonth() === now.getMonth()
                  );
                }).length
              )}
            />
          </section>

          <section className="mt-6">
            <MagazineViewsChart items={magazineChartItems} />
          </section>
        </>
      )}

      {isDevelopment && debugErrors.length > 0 && (
        <section className="mt-6 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">개발용 디버그 정보</p>
          <div className="mt-3 space-y-3">
            {debugErrors.map((error, index) => (
              <div
                key={`${error.action}-${index}`}
                className="rounded-2xl border border-red-100 bg-white/70 px-4 py-3"
              >
                <p><strong>작업:</strong> {error.action}</p>
                <p><strong>파일:</strong> {error.source}</p>
                {error.endpoint ? <p><strong>API:</strong> {error.endpoint}</p> : null}
                <p className="break-all"><strong>원인:</strong> {error.message}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-red-600">
            이 박스는 개발 중에만 보이는 임시 디버그 UI입니다. 배포 환경에서는 자동으로 숨겨집니다.
          </p>
        </section>
      )}

      <section className="mt-6">
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="panel-surface h-24 animate-pulseSoft" />
            ))}
          </div>
        ) : activeTab === "artists" ? (
          <ArtistTable
            artists={filteredSortedArtists}
            statsByArtistId={artistStats}
            statsPeriod={statsPeriod}
            onEdit={(artist) => {
              setSelectedArtist(artist);
              setArtistFormOpen(true);
            }}
            onDelete={deleteArtist}
            onToggleAd={toggleAd}
            onToggleHot={toggleHot}
            onReorder={reorderArtists}
            isSaving={saving}
          />
        ) : (
          <MagazineTable
            magazines={sortedMagazines}
            onEdit={(magazine) => {
              setSelectedMagazine(magazine);
              setMagazineFormOpen(true);
            }}
            onDelete={deleteMagazine}
            isSaving={saving}
          />
        )}
      </section>

      <button
        type="button"
        onClick={() => {
          if (activeTab === "artists") {
            setSelectedArtist(null);
            setArtistFormOpen(true);
            return;
          }

          setSelectedMagazine(null);
          setMagazineFormOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-coral text-4xl font-light text-white shadow-[0_20px_40px_rgba(255,118,74,0.35)] transition hover:scale-105"
      >
        +
      </button>

      <ArtistForm
        isOpen={artistFormOpen}
        initialArtist={selectedArtist}
        categories={categories}
        saving={saving}
        onClose={() => {
          if (saving) {
            return;
          }
          setArtistFormOpen(false);
          setSelectedArtist(null);
        }}
        onSave={persistArtist}
        onCategoriesChanged={async () => {
          await fetchCategories();
        }}
      />

      <MagazineForm
        isOpen={magazineFormOpen}
        initialMagazine={selectedMagazine}
        artists={sortedArtists}
        saving={saving}
        onClose={() => {
          if (saving) {
            return;
          }
          setMagazineFormOpen(false);
          setSelectedMagazine(null);
        }}
        onSave={persistMagazine}
      />
    </main>
  );
}
