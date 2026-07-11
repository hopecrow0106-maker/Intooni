"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type {
  AdminArtistCollaboration,
  AdminArtistDetails,
  AdminArtistStat
} from "@/lib/domain/admin-artist-details";
import { calculateCumulativeStatGrowth } from "@/lib/domain/admin-artist-details";

type InternalTab = "stats" | "contact" | "collaborations" | "b2b";

const EMPTY_DETAILS: AdminArtistDetails = {
  stats: [],
  contact: null,
  collaborations: [],
  b2b: null,
  brand_categories: []
};

type CollaborationForm = {
  id: string;
  brand_name: string;
  brand_category_id: string;
  collaboration_year: string;
  collaboration_month: string;
  post_url: string;
  content_summary: string;
  ad_disclosure_status: "yes" | "no" | "unknown";
  likes: string;
  comments: string;
  views: string;
};

const EMPTY_COLLABORATION: CollaborationForm = {
  id: "",
  brand_name: "",
  brand_category_id: "",
  collaboration_year: String(new Date().getFullYear()),
  collaboration_month: "",
  post_url: "",
  content_summary: "",
  ad_disclosure_status: "unknown",
  likes: "",
  comments: "",
  views: ""
};

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function formatNumber(value: number | null) {
  return value === null ? "-" : new Intl.NumberFormat("ko-KR").format(value);
}

function optionalInteger(value: string) {
  return value.trim() ? Number(value) : null;
}

async function readJson(response: Response) {
  const data = (await response.json()) as { message?: string };
  if (!response.ok) throw new Error(data.message ?? "요청을 처리하지 못했습니다.");
  return data;
}

function StatChart({ stats }: { stats: AdminArtistStat[] }) {
  const points = [...stats]
    .sort((left, right) => left.recorded_date.localeCompare(right.recorded_date))
    .slice(-24)
    .map((item, index, rows) => ({
      ...item,
      label: item.recorded_date.slice(5).replace("-", "/"),
      followers_delta: index === 0 ? null : item.followers - rows[index - 1].followers,
      posts_delta: index === 0 ? null : item.post_count - rows[index - 1].post_count
    }));
  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400">
        그래프를 표시하려면 두 개 이상의 기록이 필요합니다.
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-3 text-xs font-semibold text-slate-600">팔로워 · 게시물 누적 추이</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis yAxisId="followers" tick={{ fontSize: 11 }} width={58} tickFormatter={(value) => new Intl.NumberFormat("ko-KR", { notation: "compact" }).format(Number(value))} />
              <YAxis yAxisId="posts" orientation="right" tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(value, name) => [formatNumber(Number(value)), name === "followers" ? "팔로워" : "게시물"]} labelFormatter={(label) => `기록일 ${label}`} />
              <Legend formatter={(value) => value === "followers" ? "팔로워" : "게시물"} />
              <Line yAxisId="followers" type="monotone" dataKey="followers" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="posts" type="monotone" dataKey="post_count" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-3 text-xs font-semibold text-slate-600">수집 회차별 증가량</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} width={58} tickFormatter={(value) => new Intl.NumberFormat("ko-KR", { notation: "compact" }).format(Number(value))} />
              <Tooltip formatter={(value, name) => [formatNumber(Number(value)), name === "followers_delta" ? "팔로워 증가" : "게시물 증가"]} labelFormatter={(label) => `기록일 ${label}`} />
              <Legend formatter={(value) => value === "followers_delta" ? "팔로워 증가" : "게시물 증가"} />
              <Bar dataKey="followers_delta" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Bar dataKey="posts_delta" fill="#ea580c" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function ArtistInternalManager({ artistId }: { artistId?: string }) {
  const [activeTab, setActiveTab] = useState<InternalTab>("stats");
  const [details, setDetails] = useState<AdminArtistDetails>(EMPTY_DETAILS);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [statForm, setStatForm] = useState({
    recorded_date: todayInSeoul(),
    followers: "",
    post_count: ""
  });
  const [contactForm, setContactForm] = useState({ email: "", dm_available: "unknown" });
  const [collaborationForm, setCollaborationForm] = useState(EMPTY_COLLABORATION);
  const [b2bForm, setB2bForm] = useState({
    strengths: "",
    cautions: "",
    brand_safety_grade: "unknown",
    brand_category_ids: [] as string[]
  });

  const loadDetails = useCallback(async () => {
    if (!artistId) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/artists/${artistId}/details`, { cache: "no-store" });
      const data = (await readJson(response)) as AdminArtistDetails & {
        storageAvailable?: boolean;
        message?: string;
      };
      setDetails(data);
      setStorageAvailable(data.storageAvailable !== false);
      setMessage(data.message ?? "");
      setContactForm({
        email: data.contact?.email ?? "",
        dm_available:
          data.contact?.dm_available === true
            ? "yes"
            : data.contact?.dm_available === false
              ? "no"
              : "unknown"
      });
      setB2bForm({
        strengths: data.b2b?.strengths ?? "",
        cautions: data.b2b?.cautions ?? "",
        brand_safety_grade: data.b2b?.brand_safety_grade ?? "unknown",
        brand_category_ids: data.b2b?.brand_category_ids ?? []
      });
      const latest = data.stats[0];
      if (latest) {
        setStatForm((current) => ({
          ...current,
          followers: String(latest.followers),
          post_count: String(latest.post_count)
        }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "내부 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    setDetails(EMPTY_DETAILS);
    setStorageAvailable(true);
    setCollaborationForm(EMPTY_COLLABORATION);
    void loadDetails();
  }, [loadDetails]);

  const latestSummary = useMemo(() => {
    const latest = details.stats[0];
    const previous = details.stats[1];
    if (!latest) return null;
    const followersDelta = previous ? latest.followers - previous.followers : null;
    const postsDelta = previous ? latest.post_count - previous.post_count : null;
    return {
      latest,
      followersDelta,
      postsDelta,
      followersRate:
        previous && previous.followers > 0 ? (followersDelta! / previous.followers) * 100 : null,
      postsRate: previous && previous.post_count > 0 ? (postsDelta! / previous.post_count) * 100 : null
    };
  }, [details.stats]);
  const cumulativeSummary = useMemo(
    () => calculateCumulativeStatGrowth(details.stats),
    [details.stats]
  );

  if (!artistId) {
    return (
      <section className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
        작가를 먼저 저장하면 통계·연락정보·협업·B2B 내부 관리 탭을 사용할 수 있습니다.
      </section>
    );
  }

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await loadDetails();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const saveStat = async () => {
    const existing = details.stats.find((item) => item.recorded_date === statForm.recorded_date);
    if (existing && !window.confirm("같은 날짜의 통계가 있습니다. 기존 기록을 수정할까요?")) return;
    await run(async () => {
      await readJson(
        await fetch(`/api/admin/artists/${artistId}/stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recorded_date: statForm.recorded_date,
            followers: Number(statForm.followers),
            post_count: Number(statForm.post_count)
          })
        })
      );
    }, existing ? "같은 날짜의 통계를 수정했습니다." : "새 통계를 기록했습니다.");
  };

  const editCollaboration = (item: AdminArtistCollaboration) => {
    setCollaborationForm({
      id: item.id,
      brand_name: item.brand_name,
      brand_category_id: item.brand_category_id ?? "",
      collaboration_year: String(item.collaboration_year),
      collaboration_month: item.collaboration_month === null ? "" : String(item.collaboration_month),
      post_url: item.post_url,
      content_summary: item.content_summary,
      ad_disclosure_status: item.ad_disclosure_status,
      likes: item.likes === null ? "" : String(item.likes),
      comments: item.comments === null ? "" : String(item.comments),
      views: item.views === null ? "" : String(item.views)
    });
  };

  const tabs: Array<{ key: InternalTab; label: string }> = [
    { key: "stats", label: "통계" },
    { key: "contact", label: "연락정보" },
    { key: "collaborations", label: "협업 이력" },
    { key: "b2b", label: "B2B 분석" }
  ];

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-sm font-bold text-slate-800">내부 전용 정보</p>
        <p className="mt-1 text-xs text-slate-500">공개 사이트와 공개 API에는 절대 노출되지 않습니다.</p>
      </div>
      <div className="flex overflow-x-auto border-b border-slate-200 px-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`min-w-max border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === tab.key
                ? "border-ink text-ink"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-5 p-5">
        {message ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {message}
          </p>
        ) : null}
        {loading ? <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p> : null}

        {!loading && !storageAvailable ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-8 text-center">
            <p className="text-sm font-bold text-amber-900">내부 데이터 저장소 준비 필요</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              운영 DB 마이그레이션이 적용되면 통계, 연락정보, 협업 이력, B2B 분석을 사용할 수 있습니다.
              현재 공개 작가 정보에는 영향이 없습니다.
            </p>
          </div>
        ) : null}

        {!loading && storageAvailable && activeTab === "stats" ? (
          <>
            <div className="grid gap-3 md:grid-cols-5">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-slate-500">기록일</span>
                <input
                  type="date"
                  value={statForm.recorded_date}
                  onChange={(event) => setStatForm((current) => ({ ...current, recorded_date: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">팔로워</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={statForm.followers}
                  onChange={(event) => setStatForm((current) => ({ ...current, followers: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">게시물 수</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={statForm.post_count}
                  onChange={(event) => setStatForm((current) => ({ ...current, post_count: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
                />
              </label>
              <button
                type="button"
                disabled={busy || !statForm.recorded_date || !statForm.followers || !statForm.post_count}
                onClick={() => void saveStat()}
                className="self-end rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                오늘 통계 기록
              </button>
            </div>

            {latestSummary ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">최신 기록일</p><p className="mt-1 font-bold">{latestSummary.latest.recorded_date}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">최신 팔로워</p><p className="mt-1 font-bold">{formatNumber(latestSummary.latest.followers)}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">직전 기록 대비 팔로워</p><p className="mt-1 font-bold">{formatNumber(latestSummary.followersDelta)} / {latestSummary.followersRate === null ? "-" : `${latestSummary.followersRate.toFixed(2)}%`}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">직전 기록 대비 게시물</p><p className="mt-1 font-bold">{formatNumber(latestSummary.postsDelta)} / {latestSummary.postsRate === null ? "-" : `${latestSummary.postsRate.toFixed(2)}%`}</p></div>
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">누적 기록 요약</p>
              {cumulativeSummary ? (
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                  <span>{cumulativeSummary.record_count}개 기록 · {cumulativeSummary.interval_days}일 수집</span>
                  <span>{cumulativeSummary.first_recorded_date} → {cumulativeSummary.latest_recorded_date}</span>
                  <span>누적 팔로워 {formatNumber(cumulativeSummary.followers_delta)} / {cumulativeSummary.followers_growth_rate === null ? "-" : `${(cumulativeSummary.followers_growth_rate * 100).toFixed(2)}%`}</span>
                  <span>누적 게시물 {formatNumber(cumulativeSummary.posts_delta)} / {cumulativeSummary.posts_growth_rate === null ? "-" : `${(cumulativeSummary.posts_growth_rate * 100).toFixed(2)}%`}</span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">첫 통계 기록부터 꾸준히 누적해 장기 변화를 확인합니다.</p>
              )}
            </div>

            <StatChart stats={details.stats} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2">기록일</th><th className="px-3 py-2">팔로워</th><th className="px-3 py-2">게시물</th><th className="px-3 py-2 text-right">관리</th></tr></thead>
                <tbody>
                  {details.stats.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{item.recorded_date}</td><td className="px-3 py-2">{formatNumber(item.followers)}</td><td className="px-3 py-2">{formatNumber(item.post_count)}</td>
                      <td className="px-3 py-2 text-right"><button type="button" className="text-xs font-semibold text-red-500" onClick={() => { if (window.confirm("이 통계 기록을 삭제할까요?")) void run(async () => { await readJson(await fetch(`/api/admin/artists/${artistId}/stats`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stat_id: item.id }) })); }, "통계 기록을 삭제했습니다."); }}>삭제</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {!loading && storageAvailable && activeTab === "contact" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">이메일</span><input type="email" value={contactForm.email} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label>
            <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">DM 가능 여부</span><select value={contactForm.dm_available} onChange={(event) => setContactForm((current) => ({ ...current, dm_available: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5"><option value="unknown">미확인</option><option value="yes">가능</option><option value="no">불가</option></select></label>
            <button type="button" disabled={busy} onClick={() => void run(async () => { await readJson(await fetch(`/api/admin/artists/${artistId}/contact`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: contactForm.email, dm_available: contactForm.dm_available === "yes" ? true : contactForm.dm_available === "no" ? false : null }) })); }, "연락정보를 저장했습니다.")} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">연락정보 저장</button>
          </div>
        ) : null}

        {!loading && storageAvailable && activeTab === "collaborations" ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 lg:col-span-2"><span className="text-xs font-semibold text-slate-500">브랜드명</span><input value={collaborationForm.brand_name} onChange={(event) => setCollaborationForm((current) => ({ ...current, brand_name: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">브랜드 업종</span><select value={collaborationForm.brand_category_id} onChange={(event) => setCollaborationForm((current) => ({ ...current, brand_category_id: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5"><option value="">미지정</option>{details.brand_categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">광고 표시</span><select value={collaborationForm.ad_disclosure_status} onChange={(event) => setCollaborationForm((current) => ({ ...current, ad_disclosure_status: event.target.value as "yes" | "no" | "unknown" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5"><option value="unknown">미확인</option><option value="yes">표시</option><option value="no">미표시</option></select></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">연도</span><input type="number" min="2000" value={collaborationForm.collaboration_year} onChange={(event) => setCollaborationForm((current) => ({ ...current, collaboration_year: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">월</span><input type="number" min="1" max="12" value={collaborationForm.collaboration_month} onChange={(event) => setCollaborationForm((current) => ({ ...current, collaboration_month: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label>
              <label className="space-y-1 lg:col-span-2"><span className="text-xs font-semibold text-slate-500">Instagram 게시물 URL</span><input value={collaborationForm.post_url} onChange={(event) => setCollaborationForm((current) => ({ ...current, post_url: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label>
              <label className="space-y-1 lg:col-span-4"><span className="text-xs font-semibold text-slate-500">협업 내용</span><textarea rows={3} maxLength={2000} value={collaborationForm.content_summary} onChange={(event) => setCollaborationForm((current) => ({ ...current, content_summary: event.target.value }))} placeholder="예: 신제품 출시 캠페인 릴스, 제품 사용 장면과 할인 코드 소개" className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5" /><span className="block text-right text-[11px] text-slate-400">{collaborationForm.content_summary.length}/2,000</span></label>
              {(["likes", "comments", "views"] as const).map((key) => <label key={key} className="space-y-1"><span className="text-xs font-semibold text-slate-500">{{ likes: "좋아요", comments: "댓글", views: "조회수" }[key]}</span><input type="number" min="0" value={collaborationForm[key]} onChange={(event) => setCollaborationForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label>)}
              <div className="flex items-end gap-2"><button type="button" disabled={busy} onClick={() => void run(async () => { await readJson(await fetch(`/api/admin/artists/${artistId}/collaborations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...collaborationForm, collaboration_year: Number(collaborationForm.collaboration_year), collaboration_month: optionalInteger(collaborationForm.collaboration_month), likes: optionalInteger(collaborationForm.likes), comments: optionalInteger(collaborationForm.comments), views: optionalInteger(collaborationForm.views) }) })); setCollaborationForm(EMPTY_COLLABORATION); }, collaborationForm.id ? "협업 이력을 수정했습니다." : "협업 이력을 추가했습니다.")} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{collaborationForm.id ? "수정 저장" : "협업 추가"}</button>{collaborationForm.id ? <button type="button" onClick={() => setCollaborationForm(EMPTY_COLLABORATION)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">취소</button> : null}</div>
            </div>
            <div className="space-y-2">{details.collaborations.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><p className="font-semibold text-slate-800">{item.brand_name}</p><p className="mt-1 text-xs text-slate-500">{item.collaboration_year}{item.collaboration_month ? `.${item.collaboration_month}` : ""} · {item.brand_category_name ?? "업종 미지정"}</p>{item.content_summary ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.content_summary}</p> : null}<a href={item.post_url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs font-medium text-blue-600 hover:underline">{item.post_url}</a></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => editCollaboration(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">수정</button><button type="button" onClick={() => { if (window.confirm("이 협업 이력을 삭제할까요?")) void run(async () => { await readJson(await fetch(`/api/admin/artists/${artistId}/collaborations`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collaboration_id: item.id }) })); }, "협업 이력을 삭제했습니다."); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-500">삭제</button></div></div>)}</div>
          </>
        ) : null}

        {!loading && storageAvailable && activeTab === "b2b" ? (
          <div className="space-y-4">
            <div><p className="text-xs font-semibold text-slate-500">추천 브랜드 카테고리</p><div className="mt-2 flex flex-wrap gap-2">{details.brand_categories.map((item) => { const checked = b2bForm.brand_category_ids.includes(item.id); return <label key={item.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? "border-ink bg-slate-900 text-white" : "border-slate-200"}`}><input type="checkbox" checked={checked} onChange={() => setB2bForm((current) => ({ ...current, brand_category_ids: checked ? current.brand_category_ids.filter((id) => id !== item.id) : [...current.brand_category_ids, item.id] }))} className="sr-only" />{item.name}</label>; })}</div></div>
            <div className="grid gap-4 md:grid-cols-2"><label className="space-y-1"><span className="text-xs font-semibold text-slate-500">강점</span><textarea rows={5} value={b2bForm.strengths} onChange={(event) => setB2bForm((current) => ({ ...current, strengths: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label><label className="space-y-1"><span className="text-xs font-semibold text-slate-500">주의점</span><textarea rows={5} value={b2bForm.cautions} onChange={(event) => setB2bForm((current) => ({ ...current, cautions: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label></div>
            <label className="block max-w-xs space-y-1"><span className="text-xs font-semibold text-slate-500">브랜드 세이프티 등급</span><select value={b2bForm.brand_safety_grade} onChange={(event) => setB2bForm((current) => ({ ...current, brand_safety_grade: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5"><option value="unknown">미확인</option><option value="safe">안전</option><option value="normal">보통</option><option value="caution">주의</option></select></label>
            <button type="button" disabled={busy} onClick={() => void run(async () => { await readJson(await fetch(`/api/admin/artists/${artistId}/b2b`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b2bForm) })); }, "B2B 분석을 저장했습니다.")} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">B2B 분석 저장</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
