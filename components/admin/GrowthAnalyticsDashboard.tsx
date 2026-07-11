"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { AdminGrowthAnalytics, GrowthRankItem } from "@/lib/domain/admin-growth-analytics";

const COLORS = ["#dc5b43", "#98a2b3", "#d49120", "#168a55", "#315efb"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatRate(value: number | null) {
  return value === null ? "-" : `${(value * 100).toFixed(2)}%`;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function Panel({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </div>
      {children}
    </section>
  );
}

function RankingTable({ rows, mode }: { rows: GrowthRankItem[]; mode: "followers" | "posts" }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">비교 가능한 통계가 아직 없습니다.</p>;
  }
  return (
    <div className="max-h-[360px] overflow-auto">
      <table className="w-full min-w-[680px] text-left text-xs">
        <thead className="sticky top-0 bg-slate-50 text-slate-500">
          <tr><th className="px-3 py-2">작가</th><th className="px-3 py-2 text-right">현재</th><th className="px-3 py-2 text-right">증감</th><th className="px-3 py-2 text-right">증가율</th><th className="px-3 py-2 text-right">간격</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const current = mode === "followers" ? row.followers : row.post_count;
            const delta = mode === "followers" ? row.followers_delta : row.posts_delta;
            const growthRate = mode === "followers" ? row.followers_growth_rate : row.posts_growth_rate;
            return (
              <tr key={row.artist_id} className="border-t border-slate-100">
                <td className="px-3 py-2"><p className="font-semibold text-slate-800">{row.name}</p><p className="text-slate-400">@{row.instagram_handle}</p></td>
                <td className="px-3 py-2 text-right">{formatNumber(current)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${(delta ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{delta === null ? "-" : formatNumber(delta)}</td>
                <td className="px-3 py-2 text-right">{formatRate(growthRate)}</td>
                <td className="px-3 py-2 text-right text-slate-400">{row.interval_days === null ? "-" : `${row.interval_days}일`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GrowthAnalyticsDashboard({ analytics }: { analytics: AdminGrowthAnalytics }) {
  const { summary } = analytics;
  const hasTimeline = analytics.timeline.length > 0;

  return (
    <div className="mt-6 space-y-4" data-testid="growth-analytics-dashboard">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Official Artist Stats</p>
          <h2 className="mt-1 text-xl font-bold text-ink">성장 통계</h2>
        </div>
        <p className="text-xs text-slate-500">{summary.first_recorded_date ?? "-"} ~ {summary.latest_recorded_date ?? "-"} · 직전 기록과 비교</p>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="통계 보유 작가" value={formatNumber(summary.tracked_artists)} detail={`전체 스냅샷 ${formatNumber(summary.snapshot_count)}건`} />
        <Metric label="최신 총 팔로워" value={formatCompact(summary.latest_total_followers)} detail={formatNumber(summary.latest_total_followers)} />
        <Metric label="팔로워 순증" value={formatNumber(summary.followers_delta)} detail={`${formatNumber(summary.comparable_artists)}명 비교`} />
        <Metric label="최신 총 게시물" value={formatNumber(summary.latest_total_posts)} detail="작가별 최신값 합계" />
        <Metric label="게시물 순증" value={formatNumber(summary.posts_delta)} detail="직전 기록 대비" />
        <Metric label="최신 회차 커버리지" value={`${formatNumber(summary.latest_date_coverage)}명`} detail={summary.latest_recorded_date ?? "기록 없음"} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="누적 규모 추이" detail="각 기록일까지 확보된 작가별 최신 스냅샷 합계">
          <div className="h-[300px]">
            {hasTimeline ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={analytics.timeline} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}><CartesianGrid stroke="#e8ecef" vertical={false} /><XAxis dataKey="recorded_date" tick={{ fontSize: 11 }} /><YAxis yAxisId="followers" tickFormatter={formatCompact} tick={{ fontSize: 11 }} /><YAxis yAxisId="posts" orientation="right" tickFormatter={formatCompact} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => formatNumber(Number(value ?? 0))} /><Legend /><Line yAxisId="followers" type="monotone" dataKey="total_followers" name="총 팔로워" stroke="#315efb" strokeWidth={2} dot={{ r: 3 }} /><Line yAxisId="posts" type="monotone" dataKey="total_posts" name="총 게시물" stroke="#168a55" strokeWidth={2} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer> : <p className="py-24 text-center text-sm text-slate-400">통계 이력이 없습니다.</p>}
          </div>
        </Panel>

        <Panel title="회차별 순증감" detail="고정 4주가 아닌 실제 수집일 간격 기준">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.timeline} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}><CartesianGrid stroke="#e8ecef" vertical={false} /><XAxis dataKey="recorded_date" tick={{ fontSize: 11 }} /><YAxis tickFormatter={formatCompact} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => formatNumber(Number(value ?? 0))} /><Legend /><Bar dataKey="followers_delta" name="팔로워 순증" fill="#315efb" radius={[3, 3, 0, 0]} /><Bar dataKey="posts_delta" name="게시물 순증" fill="#168a55" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="팔로워 증가 상위" detail="직전 공식 기록 대비 순증">
          <div className="h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.top_followers} layout="vertical" margin={{ top: 0, right: 16, left: 48, bottom: 0 }}><CartesianGrid stroke="#e8ecef" horizontal={false} /><XAxis type="number" tickFormatter={formatCompact} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => formatNumber(Number(value ?? 0))} /><Bar dataKey="followers_delta" name="팔로워 증가" fill="#315efb" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>

        <Panel title="게시물 증가 상위" detail="직전 공식 기록 대비 업로드 증가">
          <div className="h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.top_posts} layout="vertical" margin={{ top: 0, right: 16, left: 48, bottom: 0 }}><CartesianGrid stroke="#e8ecef" horizontal={false} /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => formatNumber(Number(value ?? 0))} /><Bar dataKey="posts_delta" name="게시물 증가" fill="#168a55" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>

        <Panel title="팔로워 성장률 분포" detail="작가별 최신 두 기록 기준">
          <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.growth_distribution} dataKey="count" nameKey="label" innerRadius={62} outerRadius={102} paddingAngle={2}>{analytics.growth_distribution.map((item, index) => <Cell key={item.label} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => `${formatNumber(Number(value ?? 0))}명`} /><Legend /></PieChart></ResponsiveContainer></div>
        </Panel>

        <Panel title="통계 신선도" detail="작가별 최신 스냅샷이 얼마나 최근인지 확인">
          <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.freshness}><CartesianGrid stroke="#e8ecef" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => `${formatNumber(Number(value ?? 0))}명`} /><Bar dataKey="count" name="작가 수" fill="#d49120" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="팔로워 상승 상세" detail="수집 간격과 증가율을 함께 확인"><RankingTable rows={analytics.top_followers} mode="followers" /></Panel>
        <Panel title="팔로워 감소 점검" detail="프로필 파싱 오류 또는 실제 감소 여부 확인"><RankingTable rows={analytics.follower_declines} mode="followers" /></Panel>
      </div>
    </div>
  );
}
