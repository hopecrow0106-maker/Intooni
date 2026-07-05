"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { ArtistForm, type ArtistFormValues } from "@/components/admin/ArtistForm";
import { ArtistTable } from "@/components/admin/ArtistTable";
import { MagazineForm, type MagazineFormValues } from "@/components/admin/MagazineForm";
import { MagazineTable } from "@/components/admin/MagazineTable";
import { ToonbtiRouteMapBuilder } from "@/components/admin/ToonbtiRouteMapBuilder";
import { ToonbtiTagManager } from "@/components/admin/ToonbtiTagManager";
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

type AdminTab = "artists" | "magazines" | "toonbti" | "statistics";

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
  toonbti_result_click: number;
  toonbti_character_click: number;
  random_click: number;
};

type MagazineChartItem = {
  id: string;
  title: string;
  views: number;
};

type ToonbtiFieldKey = "mood_tags" | "episode_formats" | "style_tags" | "topic_tags";
type ArtistEventMetricKey = Exclude<keyof ArtistChartItem, "id" | "name" | "total">;

const ADMIN_ARTISTS_PER_PAGE = 20;
const ARTIST_STATS_STALE_DAYS = 14;

const ADMIN_NAV_ITEMS: Array<{
  key: AdminTab;
  label: string;
  description: string;
}> = [
  {
    key: "artists",
    label: "작가 관리",
    description: "프로필, 노출, 데이터 품질"
  },
  {
    key: "magazines",
    label: "매거진 관리",
    description: "글 작성, 발행, 조회"
  },
  {
    key: "toonbti",
    label: "툰비티아이 관리",
    description: "추천 로직과 태그"
  },
  {
    key: "statistics",
    label: "통계",
    description: "운영 성과와 검색 흐름"
  }
];

const ARTIST_EVENT_METRICS: Array<{
  key: ArtistEventMetricKey;
  label: string;
  color: string;
  surface: string;
}> = [
  {
    key: "profile_click",
    label: "전체 클릭",
    color: "#2563eb",
    surface: "bg-blue-50 text-blue-700"
  },
  {
    key: "instagram_click",
    label: "인스타 이동",
    color: "#db2777",
    surface: "bg-rose-50 text-rose-700"
  },
  {
    key: "embed_click",
    label: "임베드 이동",
    color: "#0891b2",
    surface: "bg-cyan-50 text-cyan-700"
  },
  {
    key: "hero_click",
    label: "홈 캐릭터",
    color: "#ca8a04",
    surface: "bg-yellow-50 text-yellow-700"
  },
  {
    key: "toonbti_result_click",
    label: "결과",
    color: "#059669",
    surface: "bg-emerald-50 text-emerald-700"
  },
  {
    key: "toonbti_character_click",
    label: "캐릭터",
    color: "#7c3aed",
    surface: "bg-violet-50 text-violet-700"
  },
  {
    key: "random_click",
    label: "랜덤 추천",
    color: "#0284c7",
    surface: "bg-sky-50 text-sky-700"
  }
];

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

function isStatsStale(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return Date.now() - date.getTime() > ARTIST_STATS_STALE_DAYS * 24 * 60 * 60 * 1000;
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

function getAdminTabMeta(tab: AdminTab) {
  switch (tab) {
    case "magazines":
      return {
        title: "매거진 관리",
        description: "블로그형 매거진을 작성하고 발행 상태와 조회 성과를 관리합니다."
      };
    case "toonbti":
      return {
        title: "툰비티아이 관리",
        description: "추천 경로, 태그, 결과 데이터를 관리해 매칭 품질을 유지합니다."
      };
    case "statistics":
      return {
        title: "운영 통계",
        description: "작가 반응, 검색어, 매거진 조회수, 데이터 완성도를 한 곳에서 확인합니다."
      };
    case "artists":
    default:
      return {
        title: "작가 관리",
        description: "작가 프로필, 노출 상태, 검색 태그, 반응 데이터를 관리합니다."
      };
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase text-slate-500">{label}</p>
          {helper ? <p className="mt-1 truncate text-xs text-slate-400">{helper}</p> : null}
        </div>
        <p className="shrink-0 text-xl font-bold tracking-[-0.02em] text-ink">{value}</p>
      </div>
    </div>
  );
}

function getAdminTabClass(active: boolean) {
  return `border-b-2 px-4 py-3 text-sm font-semibold transition ${
    active
      ? "border-ink text-ink"
      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-ink"
  }`;
}

function getAdminControlClass(active: boolean) {
  return `rounded-lg border px-3 py-2 text-xs font-semibold transition ${
    active
      ? "border-ink bg-ink text-white"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-ink"
  }`;
}

function ToggleSummaryPanel({
  eyebrow,
  title,
  helper,
  summary,
  open,
  onToggle,
  children
}: {
  eyebrow: string;
  title: string;
  helper: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{eyebrow}</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{helper}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
              {summary}
            </span>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
            >
              {open ? "접기" : "열기"}
            </button>
          </div>
        </div>
      </div>
      {open ? children : null}
    </section>
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Artist Stats</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
            {getStatsPeriodLabel(period)} 기준 상위 작가 반응
          </h3>
        </div>
        <p className="text-sm text-slate-500">
          카드/인스타/임베드/홈 캐릭터/툰비티아이/랜덤 추천 클릭을 구분합니다.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
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
                  {ARTIST_EVENT_METRICS.map((metric) =>
                    item[metric.key] > 0 ? (
                      <div
                        key={metric.key}
                        style={{
                          width: `${(item[metric.key] / item.total) * 100}%`,
                          backgroundColor: metric.color
                        }}
                      />
                    ) : null
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {ARTIST_EVENT_METRICS.map((metric) => (
                  <span key={metric.key} className={`rounded-md px-2.5 py-1 ${metric.surface}`}>
                    {metric.label} {formatNumber(item[metric.key])}
                  </span>
                ))}
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Magazine Views</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
            매거진 조회수 차트
          </h3>
        </div>
        <p className="text-sm text-slate-500">공개 페이지에서는 숨기고 관리자에서만 확인합니다.</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
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
                  className="h-full rounded-full bg-slate-800"
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

function RankedBarList({
  items,
  emptyLabel
}: {
  items: Array<{
    label: string;
    value: number;
    helper?: string;
    color?: string;
  }>;
  emptyLabel: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{item.label}</p>
              {item.helper ? <p className="text-xs text-slate-400">{item.helper}</p> : null}
            </div>
            <p className="shrink-0 font-semibold text-slate-600">{formatNumber(item.value)}</p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${item.value > 0 ? Math.max((item.value / maxValue) * 100, 4) : 0}%`,
                backgroundColor: item.color ?? "#2563eb"
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CompletionMeter({
  label,
  value,
  total,
  helper,
  color = "#2563eb"
}: {
  label: string;
  value: number;
  total: number;
  helper?: string;
  color?: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          {helper ? <p className="mt-1 text-xs text-slate-400">{helper}</p> : null}
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {percent}%
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {formatNumber(value)} / {formatNumber(total)}
      </p>
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
  const [showArtistStatsPanel, setShowArtistStatsPanel] = useState(false);
  const [showSearchStatsPanel, setShowSearchStatsPanel] = useState(false);
  const [artistPage, setArtistPage] = useState(1);
  const [showHiddenTagMissingOnly, setShowHiddenTagMissingOnly] = useState(false);
  const [showToonbtiMissingOnly, setShowToonbtiMissingOnly] = useState(false);
  const [showCharacterMissingOnly, setShowCharacterMissingOnly] = useState(false);

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

  const bulkUpdateToonbtiTag = async (
    field: ToonbtiFieldKey,
    from: string,
    to: string
  ) => {
    const source = from.trim();
    const target = to.trim();

    if (!source || !target || source === target) {
      return;
    }

    const matchedArtists = artists.filter((artist) => artist[field].includes(source));
    if (matchedArtists.length === 0) {
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        matchedArtists.map(async (artist) => {
          const nextValues = artist[field].map((item) => (item === source ? target : item));
          const deduped = [...new Set(nextValues.filter(Boolean))];

          const response = await fetch("/api/artists", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...artist,
              [field]: deduped
            })
          });

          const data = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(data.message ?? "툰비티아이 태그 일괄 수정에 실패했습니다.");
          }
        })
      );

      clearDebugErrors();
      await fetchArtists();
    } catch (error) {
      pushDebugError({
        action: "툰비티아이 태그 일괄 수정",
        source: "app/admin/page.tsx > bulkUpdateToonbtiTag",
        endpoint: "/api/artists",
        message:
          error instanceof Error ? error.message : "툰비티아이 태그 일괄 수정에 실패했습니다."
      });
    } finally {
      setSaving(false);
    }
  };

  const bulkDeleteToonbtiTag = async (field: ToonbtiFieldKey, value: string) => {
    const source = value.trim();
    if (!source) {
      return;
    }

    const matchedArtists = artists.filter((artist) => artist[field].includes(source));
    if (matchedArtists.length === 0) {
      return;
    }

    const confirmed = window.confirm(`"${source}" 값을 전체 작가에서 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        matchedArtists.map(async (artist) => {
          const response = await fetch("/api/artists", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...artist,
              [field]: artist[field].filter((item) => item !== source)
            })
          });

          const data = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(data.message ?? "툰비티아이 태그 전체 삭제에 실패했습니다.");
          }
        })
      );

      clearDebugErrors();
      await fetchArtists();
    } catch (error) {
      pushDebugError({
        action: "툰비티아이 태그 전체 삭제",
        source: "app/admin/page.tsx > bulkDeleteToonbtiTag",
        endpoint: "/api/artists",
        message:
          error instanceof Error ? error.message : "툰비티아이 태그 전체 삭제에 실패했습니다."
      });
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
        const createdAtDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        if (Number.isNaN(createdAtDiff) || createdAtDiff === 0) {
          return a.name.localeCompare(b.name, "ko");
        }

        return createdAtDiff;
      }),
    [artists]
  );

  const filteredSortedArtists = useMemo(() => {
    const query = artistSearch.trim().toLowerCase();
    let baseArtists = sortedArtists;

    if (showHiddenTagMissingOnly) {
      baseArtists = baseArtists.filter(
        (artist) => artist.hidden_tags.map((tag) => tag.trim()).filter(Boolean).length === 0
      );
    }

    if (showToonbtiMissingOnly) {
      baseArtists = baseArtists.filter(
        (artist) =>
          artist.mood_tags.length === 0 ||
          artist.episode_formats.length === 0 ||
          artist.style_tags.length === 0 ||
          artist.topic_tags.length === 0
      );
    }

    if (showCharacterMissingOnly) {
      baseArtists = baseArtists.filter((artist) => artist.character_url.trim().length === 0);
    }

    if (!query) {
      return baseArtists;
    }

    return baseArtists.filter((artist) => {
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
  }, [
    artistSearch,
    showCharacterMissingOnly,
    showHiddenTagMissingOnly,
    showToonbtiMissingOnly,
    sortedArtists
  ]);

  const hiddenTagMissingCount = useMemo(
    () =>
      sortedArtists.filter(
        (artist) => artist.hidden_tags.map((tag) => tag.trim()).filter(Boolean).length === 0
      ).length,
    [sortedArtists]
  );

  const toonbtiMissingCount = useMemo(
    () =>
      sortedArtists.filter(
        (artist) =>
          artist.mood_tags.length === 0 ||
          artist.episode_formats.length === 0 ||
          artist.style_tags.length === 0 ||
          artist.topic_tags.length === 0
      ).length,
    [sortedArtists]
  );

  const characterMissingCount = useMemo(
    () => sortedArtists.filter((artist) => artist.character_url.trim().length === 0).length,
    [sortedArtists]
  );

  useEffect(() => {
    setArtistPage(1);
  }, [
    artistSearch,
    activeTab,
    showCharacterMissingOnly,
    showHiddenTagMissingOnly,
    showToonbtiMissingOnly
  ]);

  const totalArtistPages = Math.max(1, Math.ceil(filteredSortedArtists.length / ADMIN_ARTISTS_PER_PAGE));
  const safeArtistPage = Math.min(artistPage, totalArtistPages);
  const paginatedArtists = useMemo(() => {
    const start = (safeArtistPage - 1) * ADMIN_ARTISTS_PER_PAGE;
    return filteredSortedArtists.slice(start, start + ADMIN_ARTISTS_PER_PAGE);
  }, [filteredSortedArtists, safeArtistPage]);

  const sortedMagazines = useMemo(
    () =>
      [...magazines].sort((a, b) => {
        const publishedDiff =
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime();

        if (publishedDiff !== 0) {
          return publishedDiff;
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
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
            hero_click: 0,
            toonbti_result_click: 0,
            toonbti_character_click: 0,
            random_click: 0
          };
        }

        const total =
          stats.profile_click +
          stats.instagram_click +
          stats.embed_click +
          stats.hero_click +
          stats.toonbti_result_click +
          stats.toonbti_character_click +
          stats.random_click;

        return {
          id: artist.id,
          name: artist.name,
          total,
          profile_click: stats.profile_click,
          instagram_click: stats.instagram_click,
          embed_click: stats.embed_click,
          hero_click: stats.hero_click,
          toonbti_result_click: stats.toonbti_result_click,
          toonbti_character_click: stats.toonbti_character_click,
          random_click: stats.random_click
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [artistStats, sortedArtists]);

  const artistChartItems = useMemo(
    () => allArtistChartItems.slice(0, showAllArtistStats ? allArtistChartItems.length : 5),
    [allArtistChartItems, showAllArtistStats]
  );

  const totalArtistInteractions = useMemo(
    () => allArtistChartItems.reduce((sum, item) => sum + item.total, 0),
    [allArtistChartItems]
  );

  const topSearchQueries = useMemo(
    () => searchQueries.slice(0, showAllSearchQueries ? searchQueries.length : 5),
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

  const artistEventTotals = useMemo(() => {
    return ARTIST_EVENT_METRICS.reduce<Record<ArtistEventMetricKey, number>>((acc, metric) => {
      acc[metric.key] = allArtistChartItems.reduce((sum, item) => sum + item[metric.key], 0);
      return acc;
    }, {
      profile_click: 0,
      instagram_click: 0,
      embed_click: 0,
      hero_click: 0,
      toonbti_result_click: 0,
      toonbti_character_click: 0,
      random_click: 0
    });
  }, [allArtistChartItems]);

  const topArtistChartItem = allArtistChartItems[0] ?? null;

  const totalSearchCount = useMemo(
    () => searchQueries.reduce((sum, item) => sum + item.count, 0),
    [searchQueries]
  );

  const topSearchQuery = searchQueries[0] ?? null;

  const latestSearchQuery = useMemo(
    () =>
      [...searchQueries].sort(
        (a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime()
      )[0] ?? null,
    [searchQueries]
  );

  const publicMagazineCount = useMemo(
    () => sortedMagazines.filter((magazine) => magazine.is_public).length,
    [sortedMagazines]
  );

  const draftMagazineCount = sortedMagazines.length - publicMagazineCount;

  const thisMonthMagazineCount = useMemo(
    () =>
      sortedMagazines.filter((magazine) => {
        const published = new Date(magazine.published_at);
        const now = new Date();
        return (
          published.getFullYear() === now.getFullYear() &&
          published.getMonth() === now.getMonth()
        );
      }).length,
    [sortedMagazines]
  );

  const averageMagazineViews =
    sortedMagazines.length > 0 ? Math.round(totalMagazineViews / sortedMagazines.length) : 0;

  const toonbtiReadyCount = Math.max(sortedArtists.length - toonbtiMissingCount, 0);
  const hiddenTagReadyCount = Math.max(sortedArtists.length - hiddenTagMissingCount, 0);
  const characterReadyCount = Math.max(sortedArtists.length - characterMissingCount, 0);
  const staleStatsCount = useMemo(
    () => sortedArtists.filter((artist) => isStatsStale(artist.last_stats_updated_at)).length,
    [sortedArtists]
  );

  const activeTabMeta = getAdminTabMeta(activeTab);
  const primaryActionLabel =
    activeTab === "artists"
      ? "작가 추가"
      : activeTab === "magazines" && !magazineFormOpen
        ? "매거진 작성"
        : null;

  const handlePrimaryAction = () => {
    if (activeTab === "artists") {
      setSelectedArtist(null);
      setArtistFormOpen(true);
      return;
    }

    if (activeTab === "magazines") {
      setSelectedMagazine(null);
      setMagazineFormOpen(true);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  if (!authenticated) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-ink">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Instoon Admin
            </p>
            <h1 className="mt-2 text-xl font-bold tracking-[-0.02em] text-ink">
              운영 관리 콘솔
            </h1>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {ADMIN_NAV_ITEMS.map((item) => {
              const active = activeTab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full rounded-lg px-3 py-3 text-left transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`mt-0.5 block text-xs ${active ? "text-white/65" : "text-slate-400"}`}>
                    {item.description}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              System Snapshot
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-400">작가</p>
                <p className="mt-1 text-lg font-bold text-ink">{formatNumber(sortedArtists.length)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-400">매거진</p>
                <p className="mt-1 text-lg font-bold text-ink">{formatNumber(sortedMagazines.length)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-400">반응</p>
                <p className="mt-1 text-lg font-bold text-ink">{formatNumber(totalArtistInteractions)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-400">검색</p>
                <p className="mt-1 text-lg font-bold text-ink">{formatNumber(totalSearchCount)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
            >
              로그아웃
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Operations Workspace
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink">
                  {activeTabMeta.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{activeTabMeta.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {primaryActionLabel ? (
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    {primaryActionLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink lg:hidden"
                >
                  로그아웃
                </button>
              </div>
            </div>

            <div className="mx-auto mt-4 flex w-full max-w-[1600px] flex-wrap border-b border-slate-200 lg:hidden">
              {ADMIN_NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={getAdminTabClass(activeTab === item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6">

      {activeTab === "artists" ? (
        <>
          <section className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
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
                className={getAdminControlClass(statsPeriod === period)}
              >
                {label} 통계
              </button>
            ))}
              <button
                type="button"
                onClick={() => setShowHiddenTagMissingOnly((current) => !current)}
                className={getAdminControlClass(showHiddenTagMissingOnly)}
              >
                숨김태그 누락만 {formatNumber(hiddenTagMissingCount)}
              </button>
              <button
                type="button"
                onClick={() => setShowToonbtiMissingOnly((current) => !current)}
                className={getAdminControlClass(showToonbtiMissingOnly)}
              >
                툰비티아이 누락만 {formatNumber(toonbtiMissingCount)}
              </button>
              <button
                type="button"
                onClick={() => setShowCharacterMissingOnly((current) => !current)}
                className={getAdminControlClass(showCharacterMissingOnly)}
              >
                누끼 PNG 누락만 {formatNumber(characterMissingCount)}
              </button>
            </div>

            <div className="max-w-md">
              <input
                value={artistSearch}
                onChange={(event) => setArtistSearch(event.target.value)}
                placeholder="작가명, 인스타 계정, 카테고리, 태그로 검색"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ink"
              />
            </div>
          </section>

          <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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

          <div className="mt-6">
            <ToggleSummaryPanel
              eyebrow="Artist Stats"
              title={`${getStatsPeriodLabel(statsPeriod)} 기준 상위 작가 반응`}
              helper="커다란 차트는 필요할 때만 열어서 확인합니다."
              summary={
                topArtistChartItem
                  ? `1위 ${topArtistChartItem.name} · ${formatNumber(topArtistChartItem.total)}`
                  : "집계 없음"
              }
              open={showArtistStatsPanel}
              onToggle={() => setShowArtistStatsPanel((current) => !current)}
            >
              <>
                <ArtistStatsChart items={artistChartItems} period={statsPeriod} />
                {allArtistChartItems.length > 5 ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAllArtistStats((current) => !current)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                    >
                      {showAllArtistStats ? "상위 5개만 보기" : "전체 보기"}
                    </button>
                  </div>
                ) : null}
              </>
            </ToggleSummaryPanel>
          </div>

          <div className="mt-6">
            <ToggleSummaryPanel
              eyebrow="Search Keywords"
              title="사람들이 찾은 검색어"
              helper="검색어 목록도 필요할 때만 열어서 확인합니다."
              summary={
                topSearchQuery
                  ? `1위 "${topSearchQuery.query}" · ${formatNumber(topSearchQuery.count)}회`
                  : "집계 없음"
              }
              open={showSearchStatsPanel}
              onToggle={() => setShowSearchStatsPanel((current) => !current)}
            >
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search Keywords</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                      {getStatsPeriodLabel(statsPeriod)} 기준 상위 검색어
                    </h3>
                  </div>
                  <p className="text-sm text-slate-500">총 {formatNumber(totalSearchCount)}회 검색</p>
                </div>

                {topSearchQueries.length === 0 ? (
                  <div className="mt-5 rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                    아직 기록된 검색어가 없습니다.
                  </div>
                ) : (
                  <div className="mt-6">
                    <RankedBarList
                      items={topSearchQueries.map((item) => ({
                        label: item.query,
                        value: item.count,
                        helper: `최근 검색 ${new Intl.DateTimeFormat("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        }).format(new Date(item.latest_at))}`,
                        color: "#2563eb"
                      }))}
                      emptyLabel="아직 기록된 검색어가 없습니다."
                    />
                  </div>
                )}

                {searchQueries.length > 5 ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAllSearchQueries((current) => !current)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
                    >
                      {showAllSearchQueries ? "상위 5개만 보기" : "전체 보기"}
                    </button>
                  </div>
                ) : null}
              </section>
            </ToggleSummaryPanel>
          </div>

        </>
      ) : activeTab === "magazines" ? (
        magazineFormOpen ? (
          <section className="mt-4">
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
          </section>
        ) : (
          <>
            <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
                value={formatNumber(thisMonthMagazineCount)}
              />
            </section>

            <section className="mt-6">
              <MagazineViewsChart items={magazineChartItems} />
            </section>
          </>
        )
      ) : activeTab === "statistics" ? (
        <>
          <section className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
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
                className={getAdminControlClass(statsPeriod === period)}
              >
                {label} 기준
              </button>
            ))}
          </section>

          <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              label="작가 총 반응"
              value={formatNumber(totalArtistInteractions)}
              helper={`${getStatsPeriodLabel(statsPeriod)} 기준 모든 이벤트 합산`}
            />
            <StatsCard
              label="검색 총량"
              value={formatNumber(totalSearchCount)}
              helper={`${formatNumber(searchQueries.length)}개 검색어`}
            />
            <StatsCard
              label="매거진 누적 조회"
              value={formatNumber(totalMagazineViews)}
              helper={`평균 ${formatNumber(averageMagazineViews)}회`}
            />
            <StatsCard
              label="데이터 보강 필요"
              value={formatNumber(hiddenTagMissingCount + toonbtiMissingCount + characterMissingCount)}
              helper="숨김태그, 툰비티아이, 누끼 PNG 누락 합산"
            />
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Artist Operations</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                    작가 관리 통계
                  </h3>
                </div>
                <p className="text-sm text-slate-500">
                  상위 작가와 클릭 종류별 비중을 봅니다.
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">상위 반응 작가</p>
                  <p className="mt-2 truncate text-2xl font-bold tracking-[-0.03em] text-ink">
                    {topArtistChartItem ? topArtistChartItem.name : "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {topArtistChartItem
                      ? `${formatNumber(topArtistChartItem.total)}회 반응`
                      : "아직 집계 없음"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">업데이트 필요</p>
                  <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink">
                    {formatNumber(staleStatsCount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {ARTIST_STATS_STALE_DAYS}일 이상 통계 갱신 없음
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <RankedBarList
                  items={ARTIST_EVENT_METRICS.map((metric) => ({
                    label: metric.label,
                    value: artistEventTotals[metric.key],
                    color: metric.color
                  }))}
                  emptyLabel="아직 작가 반응 데이터가 없습니다."
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Magazine Performance</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                    매거진 관리 통계
                  </h3>
                </div>
                <p className="text-sm text-slate-500">조회수와 발행 상태를 확인합니다.</p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">공개 글</p>
                  <p className="mt-2 text-2xl font-bold text-ink">{formatNumber(publicMagazineCount)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">임시저장</p>
                  <p className="mt-2 text-2xl font-bold text-ink">{formatNumber(draftMagazineCount)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">이번 달 게시</p>
                  <p className="mt-2 text-2xl font-bold text-ink">{formatNumber(thisMonthMagazineCount)}</p>
                </div>
              </div>

              <div className="mt-5">
                <RankedBarList
                  items={magazineChartItems.map((item) => ({
                    label: item.title,
                    value: item.views,
                    helper: "조회수",
                    color: "#2563eb"
                  }))}
                  emptyLabel="등록된 매거진이 아직 없습니다."
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">ToonBTI Readiness</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                    툰비티아이 관리 통계
                  </h3>
                </div>
                <p className="text-sm text-slate-500">추천 품질에 필요한 데이터 완성도입니다.</p>
              </div>

              <div className="mt-5 grid gap-3">
                <CompletionMeter
                  label="툰비티아이 태그 완성"
                  value={toonbtiReadyCount}
                  total={sortedArtists.length}
                  helper="톤, 포맷, 그림체, 주제 태그가 모두 있는 작가"
                  color="#059669"
                />
                <CompletionMeter
                  label="숨김 검색 태그 준비"
                  value={hiddenTagReadyCount}
                  total={sortedArtists.length}
                  helper="검색 품질을 보강하는 비노출 태그"
                  color="#ca8a04"
                />
                <CompletionMeter
                  label="캐릭터 PNG 준비"
                  value={characterReadyCount}
                  total={sortedArtists.length}
                  helper="툰비티아이/홈 캐릭터 노출용 이미지"
                  color="#0284c7"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search Insights</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                    검색 통계
                  </h3>
                </div>
                <p className="text-sm text-slate-500">사람들이 원하는 작가/주제를 파악합니다.</p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">상위 검색어</p>
                  <p className="mt-2 truncate text-2xl font-bold tracking-[-0.03em] text-ink">
                    {topSearchQuery ? topSearchQuery.query : "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {topSearchQuery ? `${formatNumber(topSearchQuery.count)}회` : "아직 집계 없음"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">최근 검색어</p>
                  <p className="mt-2 truncate text-2xl font-bold tracking-[-0.03em] text-ink">
                    {latestSearchQuery ? latestSearchQuery.query : "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {latestSearchQuery
                      ? new Intl.DateTimeFormat("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        }).format(new Date(latestSearchQuery.latest_at))
                      : "아직 집계 없음"}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <RankedBarList
                  items={searchQueries.slice(0, 8).map((item) => ({
                    label: item.query,
                    value: item.count,
                    helper: "검색 횟수",
                    color: "#2563eb"
                  }))}
                  emptyLabel="아직 기록된 검색어가 없습니다."
                />
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Recommended Metrics</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
              앞으로 보면 좋은 운영 지표
            </h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["검색 후 클릭 전환", "검색어가 실제 작가 클릭으로 이어지는지 보면 추천/검색 품질을 판단할 수 있습니다."],
                ["작가별 데이터 완성도", "숨김태그, ToonBTI 태그, 캐릭터 PNG가 갖춰진 작가일수록 노출 품질이 안정됩니다."],
                ["매거진 조회 대비 관련 작가 클릭", "콘텐츠가 실제 작가 탐색으로 이어지는지 확인하는 핵심 지표입니다."],
                ["기간별 상승 작가", "최근 7일 반응이 급증한 작가를 홈/매거진에서 밀어줄 수 있습니다."]
              ].map(([title, body]) => (
                <div key={title} className="rounded-lg border border-slate-100 bg-white px-4 py-4">
                  <p className="text-sm font-bold text-ink">{title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{body}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="mt-6 space-y-6">
          <ToonbtiRouteMapBuilder artists={sortedArtists} />
          <ToonbtiTagManager
            artists={sortedArtists}
            saving={saving}
            onBulkReplace={bulkUpdateToonbtiTag}
            onBulkDelete={bulkDeleteToonbtiTag}
            onOpenArtist={(artist) => {
              setActiveTab("artists");
              setSelectedArtist(artist);
              setArtistFormOpen(true);
            }}
          />
        </section>
      )}

      {isDevelopment && debugErrors.length > 0 && (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">개발용 디버그 정보</p>
          <div className="mt-3 space-y-3">
            {debugErrors.map((error, index) => (
              <div
                key={`${error.action}-${index}`}
                className="rounded-lg border border-red-100 bg-white/70 px-4 py-3"
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
              <div key={index} className="h-20 rounded-xl border border-slate-200 bg-white shadow-sm animate-pulseSoft" />
            ))}
          </div>
        ) : activeTab === "artists" ? (
          <>
            <div className="mb-3 flex flex-col gap-1 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <span>
                최신 등록순 ·{" "}
                {filteredSortedArtists.length > 0
                  ? `${formatNumber(filteredSortedArtists.length)}명 중 ${formatNumber(
                      (safeArtistPage - 1) * ADMIN_ARTISTS_PER_PAGE + 1
                    )}-${formatNumber(
                      Math.min(safeArtistPage * ADMIN_ARTISTS_PER_PAGE, filteredSortedArtists.length)
                    )}명 표시`
                  : "표시할 작가 없음"}
              </span>
              <span>페이지당 {ADMIN_ARTISTS_PER_PAGE}명</span>
            </div>
            <ArtistTable
              artists={paginatedArtists}
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
              reorderEnabled={false}
            />
            {totalArtistPages > 1 ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: totalArtistPages }).map((_, index) => {
                  const page = index + 1;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setArtistPage(page)}
                      className={`h-10 min-w-10 rounded-lg border px-3 text-sm font-semibold transition ${
                        safeArtistPage === page
                          ? "border-ink bg-ink text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:border-ink hover:text-ink"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : activeTab === "magazines" && !magazineFormOpen ? (
          <MagazineTable
            magazines={sortedMagazines}
            onEdit={(magazine) => {
              setSelectedMagazine(magazine);
              setMagazineFormOpen(true);
            }}
            onDelete={deleteMagazine}
            isSaving={saving}
          />
        ) : null}
      </section>

          </div>
        </div>
      </div>

      <ArtistForm
        isOpen={artistFormOpen}
        initialArtist={selectedArtist}
        categories={categories}
        stats={selectedArtist ? artistStats[selectedArtist.id] ?? null : null}
        statsPeriod={statsPeriod}
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

    </main>
  );
}
