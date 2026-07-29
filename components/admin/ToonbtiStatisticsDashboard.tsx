"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { AdminToonbtiAnalytics } from "@/lib/domain/admin-toonbti-analytics";

const TYPE_COLORS = [
  "#fd4c6c",
  "#315efb",
  "#168a55",
  "#d49120",
  "#7c3aed",
  "#0891b2"
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function Metric({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-r border-slate-200 px-4 py-3 last:border-r-0">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

export function ToonbtiStatisticsDashboard({
  analytics
}: {
  analytics: AdminToonbtiAnalytics;
}) {
  const { summary } = analytics;
  const chartData = analytics.types.map((item) => ({
    ...item,
    label: item.name ? `${item.code} · ${item.name}` : item.code
  }));

  return (
    <section
      className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      data-testid="toonbti-statistics-dashboard"
    >
      <header className="border-b border-slate-200 px-5 py-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#fd4c6c]">
              Toon-BTI Artist Distribution
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-ink">
              툰-비티아이별 작가 통계
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            숨김·보관 작가도 전체 분포에 포함하며 상태별 수를 따로 표시합니다.
          </p>
        </div>
      </header>

      <div className="grid border-b border-slate-200 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="유형 지정 작가"
          value={`${formatNumber(summary.assigned_artists)}명`}
          detail={`전체 ${formatNumber(summary.total_artists)}명 중 ${summary.assignment_rate}%`}
        />
        <Metric
          label="미지정 작가"
          value={`${formatNumber(summary.unassigned_artists)}명`}
          detail="기본 정보에서 유형 지정 필요"
        />
        <Metric
          label="가장 많은 유형"
          value={summary.most_common_code ?? "-"}
          detail={
            summary.most_common_code
              ? `${summary.most_common_name || "이름 미설정"} · ${formatNumber(summary.most_common_count)}명`
              : "아직 지정된 유형 없음"
          }
        />
        <Metric
          label="설정된 결과 유형"
          value={`${formatNumber(summary.configured_types)}개`}
          detail="최대 16개 조합"
        />
      </div>

      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="min-w-0 border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-ink">유형별 작가 수</h3>
            <p className="mt-1 text-xs text-slate-400">
              작가가 많은 순서입니다. 막대에 마우스를 올리면 비율을 확인할 수 있습니다.
            </p>
          </div>
          {chartData.length > 0 ? (
            <div style={{ height: Math.max(360, chartData.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 16, bottom: 4 }}
                >
                  <CartesianGrid stroke="#e8ecef" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={128}
                    tick={{ fontSize: 11, fill: "#334155" }}
                  />
                  <Tooltip
                    formatter={(value, _name, item) => [
                      `${formatNumber(Number(value ?? 0))}명 · ${item.payload.share}%`,
                      "작가"
                    ]}
                  />
                  <Bar dataKey="count" name="작가" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {chartData.map((item, index) => (
                      <Cell
                        key={item.result_type_id}
                        fill={TYPE_COLORS[index % TYPE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-24 text-center text-sm text-slate-400">
              설정된 툰-비티아이 결과 유형이 없습니다.
            </p>
          )}
        </div>

        <div className="min-w-0 p-5">
          <div className="mb-5">
            <h3 className="text-sm font-bold text-ink">4축 성향 비율</h3>
            <p className="mt-1 text-xs text-slate-400">
              지정된 결과 코드의 각 자리를 축별로 나누어 계산합니다.
            </p>
          </div>
          <div className="space-y-6">
            {analytics.axes.map((axis) => (
              <div key={axis.axis_id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">
                    {axis.position + 1}축 · {axis.left.name} / {axis.right.name}
                  </p>
                  <p className="text-xs text-slate-400">{formatNumber(axis.total)}명</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 text-xs">
                  <span className="font-semibold text-[#315efb]">
                    {axis.left.code} {axis.left.name} {axis.left.share}%
                  </span>
                  <span className="font-semibold text-[#fd4c6c]">
                    {axis.right.code} {axis.right.name} {axis.right.share}%
                  </span>
                </div>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-[#315efb]"
                    style={{ width: `${axis.left.share}%` }}
                    title={`${axis.left.name} ${axis.left.count}명`}
                  />
                  <div
                    className="h-full bg-[#fd4c6c]"
                    style={{ width: `${axis.right.share}%` }}
                    title={`${axis.right.name} ${axis.right.count}명`}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                  <span>{formatNumber(axis.left.count)}명</span>
                  <span>{formatNumber(axis.right.count)}명</span>
                </div>
              </div>
            ))}
            {analytics.axes.length === 0 ? (
              <p className="py-20 text-center text-sm text-slate-400">
                활성화된 4축 설정이 없습니다.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {analytics.types.length > 0 ? (
        <div className="border-t border-slate-200">
          <div className="px-5 py-4">
            <h3 className="text-sm font-bold text-ink">유형별 상태 상세</h3>
            <p className="mt-1 text-xs text-slate-400">
              전체 수 안에서 활성·숨김·보관 작가가 각각 몇 명인지 확인합니다.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3">유형</th>
                  <th className="px-4 py-3">결과 이름</th>
                  <th className="px-4 py-3 text-right">전체</th>
                  <th className="px-4 py-3 text-right">비율</th>
                  <th className="px-4 py-3 text-right">활성</th>
                  <th className="px-4 py-3 text-right">숨김</th>
                  <th className="px-5 py-3 text-right">보관</th>
                </tr>
              </thead>
              <tbody>
                {analytics.types.map((item) => (
                  <tr key={item.result_type_id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-bold text-ink">{item.code}</td>
                    <td className="px-4 py-3 text-slate-600">{item.name || "이름 미설정"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {formatNumber(item.count)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{item.share}%</td>
                    <td className="px-4 py-3 text-right text-emerald-600">
                      {formatNumber(item.active_count)}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600">
                      {formatNumber(item.hidden_count)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500">
                      {formatNumber(item.archived_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
