"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

type MonthData = {
  month: number;
  count: number;
  total: number;
  pension: number;
  campnic: number;
  extra: number;
  yasugyo: number;
};

type YearlyData = {
  count: number;
  total: number;
  pension: number;
  campnic: number;
  extra: number;
  yasugyo: number;
};

type SalesResponse = {
  year: number;
  yearly: YearlyData;
  months: MonthData[];
};

type ComparisonYear = {
  year: number;
  monthlyTotals: number[];
  monthlyCounts: number[];
  cumulativeTotals: number[];
  cumulativeCounts: number[];
  totalToDate: number;
  countToDate: number;
};

type TooltipState = {
  visible: boolean;
  pageX: number;
  pageY: number;
  year: number;
  month: number;
  monthTotal: number;
  monthCount: number;
  cumulativeTotal: number;
  cumulativeCount: number;
  color: string;
  label: string;
};

const COLORS = [
  { line: "#DB5461", badge: "bg-rose-500", badgeSoft: "bg-rose-500/10" },
  { line: "#6366F1", badge: "bg-indigo-500", badgeSoft: "bg-indigo-500/10" },
  { line: "#10B981", badge: "bg-emerald-500", badgeSoft: "bg-emerald-500/10" },
];

function fmt(n: number) {
  return (n || 0).toLocaleString();
}

function buildPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function ComparisonPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const years = useMemo(() => [currentYear - 2, currentYear - 1, currentYear], [currentYear]);
  const initialDateType = (searchParams.get("dateType") || "visit") as "visit" | "deposit";

  const [dateType, setDateType] = useState<"visit" | "deposit">(initialDateType);
  const [dataMap, setDataMap] = useState<Record<number, SalesResponse | null>>({});
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const chartWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchComparison = async () => {
      setLoading(true);
      try {
        const responses = await Promise.all(
          years.map(async (year) => {
            const res = await fetch(`/api/admin/sales/yearly?year=${year}&dateType=${dateType}`);
            if (!res.ok) return [year, null] as const;
            return [year, (await res.json()) as SalesResponse] as const;
          })
        );

        const nextMap: Record<number, SalesResponse | null> = {};
        for (const [year, data] of responses) {
          nextMap[year] = data;
        }
        setDataMap(nextMap);
      } catch (error) {
        console.error("Failed to fetch comparison sales data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [dateType, years]);

  const handleDateTypeChange = (nextDateType: "visit" | "deposit") => {
    setDateType(nextDateType);
    router.replace(`/admin/sales/comparison?dateType=${nextDateType}`);
  };

  const comparison = useMemo(() => {
    return years.map((year, yearIndex) => {
      const months = dataMap[year]?.months || [];
      const monthRange = Array.from({ length: currentMonth }, (_, i) => i + 1);
      const monthlyTotals = monthRange.map((month) => months.find((m) => m.month === month)?.total ?? 0);
      const monthlyCounts = monthRange.map((month) => months.find((m) => m.month === month)?.count ?? 0);

      let total = 0;
      let count = 0;
      const cumulativeTotals = monthlyTotals.map((value) => {
        total += value;
        return total;
      });
      const cumulativeCounts = monthlyCounts.map((value) => {
        count += value;
        return count;
      });

      return {
        year,
        monthlyTotals,
        monthlyCounts,
        cumulativeTotals,
        cumulativeCounts,
        totalToDate: cumulativeTotals[cumulativeTotals.length - 1] || 0,
        countToDate: cumulativeCounts[cumulativeCounts.length - 1] || 0,
      } satisfies ComparisonYear;
    });
  }, [currentMonth, dataMap, years]);

  const chartMonths = Array.from({ length: currentMonth }, (_, i) => i + 1);
  const maxValue = Math.max(
    ...comparison.flatMap((item) => item.cumulativeTotals),
    1
  );

  const chartWidth = 1000;
  const chartHeight = 360;
  const paddingLeft = 60;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 54;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const xStep = chartMonths.length > 1 ? innerWidth / (chartMonths.length - 1) : 0;

  const monthLabel = (month: number) => `${month}월`;
  const getTooltipPosition = (x: number, y: number) => {
    const container = chartWrapRef.current;
    const tooltipWidth = 260;
    const tooltipHeight = 180;
    const margin = 16;

    if (!container || typeof window === "undefined") {
      return { pageX: x, pageY: y };
    }

    const rect = container.getBoundingClientRect();
    const anchorX = rect.left + (x / chartWidth) * rect.width;
    const anchorY = rect.top + (y / chartHeight) * rect.height;
    const spaceAbove = anchorY - rect.top;
    const spaceBelow = rect.bottom - anchorY;
    const placement = spaceAbove >= tooltipHeight + margin || spaceAbove > spaceBelow ? "above" : "below";

    const pageX = Math.min(
      window.innerWidth - margin - tooltipWidth / 2,
      Math.max(margin + tooltipWidth / 2, anchorX)
    );
    const pageY = placement === "above"
      ? Math.max(margin, anchorY - tooltipHeight - 18)
      : Math.min(window.innerHeight - tooltipHeight - margin, anchorY + 18);

    return { pageX, pageY };
  };

  return (
    <main className="calendar-viewport p-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => handleDateTypeChange("visit")}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              dateType === "visit"
                ? "bg-white dark:bg-zinc-700 text-[#DB5461] shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
            }`}
          >
            방문일 기준
          </button>
          <button
            type="button"
            onClick={() => handleDateTypeChange("deposit")}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              dateType === "deposit"
                ? "bg-white dark:bg-zinc-700 text-[#DB5461] shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
            }`}
          >
            입금일 기준
          </button>
        </div>

        <div className="text-right">
          <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-zinc-100 tracking-tight">
            최근 3개년 비교 매출
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            {years.join(" / ")} 현재까지 누적 추이
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {comparison.map((item, index) => {
          const palette = COLORS[index];
          return (
            <div key={item.year} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${palette.badgeSoft} text-slate-700 dark:text-zinc-200 text-xs font-bold`}>
                  <span className={`w-2 h-2 rounded-full ${palette.badge}`} />
                  {item.year}년
                </div>
                <span className="text-[11px] text-slate-400">
                  {dateType === "deposit" ? "입금일 기준" : "방문일 기준"}
                </span>
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">
                {loading ? "—" : fmt(item.totalToDate)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">누적 금액 원</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">누적 건수</div>
                  <div className="text-sm font-black text-slate-800 dark:text-zinc-100 mt-1">
                    {loading ? "—" : fmt(item.countToDate)}
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">월 평균</div>
                  <div className="text-sm font-black text-slate-800 dark:text-zinc-100 mt-1">
                    {loading ? "—" : fmt(Math.round(item.totalToDate / Math.max(chartMonths.length, 1)))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-black text-slate-700 dark:text-zinc-200">
              {dateType === "deposit" ? "입금일 기준" : "방문일 기준"} 연도별 누적 추이
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              올해 기준 현재 월까지 비교합니다. 이후 달은 그래프에서 제외됩니다.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {comparison.map((item, index) => (
              <div
                key={item.year}
                className="flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/70 px-3 py-1.5 shadow-sm"
              >
                <span className={`w-10 h-1.5 rounded-full ${COLORS[index].badge}`} />
                <span className="text-xs font-black text-slate-700 dark:text-zinc-200">
                  {item.year}년
                </span>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-[420px] flex items-center justify-center text-slate-400 text-sm">그래프 로딩 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <div ref={chartWrapRef} className="relative w-full min-w-[900px]">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-[420px]"
                role="img"
                aria-label="년도별 비교 매출 그래프"
              >
                <defs>
                  <linearGradient id="gridFade" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#e4e4e7" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#e4e4e7" stopOpacity="0.08" />
                  </linearGradient>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const y = paddingTop + innerHeight * ratio;
                  return (
                    <g key={ratio}>
                      <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="url(#gridFade)" strokeWidth="1" />
                      <text x={paddingLeft - 10} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-bold">
                        {index === 0 ? fmt(Math.round(maxValue / 10000)) + "만" : ""}
                      </text>
                    </g>
                  );
                })}

                {chartMonths.map((month, idx) => {
                  const x = paddingLeft + idx * xStep;
                  return (
                    <g key={month}>
                      <line
                        x1={x}
                        y1={paddingTop}
                        x2={x}
                        y2={chartHeight - paddingBottom}
                        stroke="#e4e4e7"
                        strokeWidth="1"
                        strokeDasharray="4 6"
                      />
                      <text x={x} y={chartHeight - 24} textAnchor="middle" className="fill-slate-500 text-[11px] font-bold">
                        {monthLabel(month)}
                      </text>
                    </g>
                  );
                })}

                {comparison.map((item, index) => {
                  const color = index === 0 ? "#DB5461" : index === 1 ? "#6366F1" : "#10B981";
                  const points = item.cumulativeTotals.map((value, pointIndex) => {
                    const x = paddingLeft + pointIndex * xStep;
                    const y = paddingTop + innerHeight - (value / maxValue) * innerHeight;
                    return { x, y };
                  });
                  return (
                    <g key={item.year}>
                      <path
                        d={buildPath(points)}
                        fill="none"
                        stroke={color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {points.map((point, pointIndex) => (
                        <g
                          key={`${item.year}-${pointIndex}`}
                          onMouseEnter={() =>
                            setTooltip({
                              visible: true,
                              ...getTooltipPosition(point.x, point.y),
                              year: item.year,
                              month: chartMonths[pointIndex],
                              monthTotal: item.monthlyTotals[pointIndex],
                              monthCount: item.monthlyCounts[pointIndex],
                              cumulativeTotal: item.cumulativeTotals[pointIndex],
                              cumulativeCount: item.cumulativeCounts[pointIndex],
                              color,
                              label: item.year.toString(),
                            })
                          }
                          onMouseMove={() =>
                            setTooltip((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    ...getTooltipPosition(point.x, point.y),
                                  }
                                : prev
                            )
                          }
                          onMouseLeave={() => setTooltip(null)}
                          onFocus={() =>
                            setTooltip({
                              visible: true,
                              ...getTooltipPosition(point.x, point.y),
                              year: item.year,
                              month: chartMonths[pointIndex],
                              monthTotal: item.monthlyTotals[pointIndex],
                              monthCount: item.monthlyCounts[pointIndex],
                              cumulativeTotal: item.cumulativeTotals[pointIndex],
                              cumulativeCount: item.cumulativeCounts[pointIndex],
                              color,
                              label: item.year.toString(),
                            })
                          }
                          tabIndex={0}
                          role="button"
                          aria-label={`${item.year}년 ${chartMonths[pointIndex]}월 매출 상세`}
                        >
                          <circle cx={point.x} cy={point.y} r="5.5" fill={color} opacity="0.95" />
                          <circle cx={point.x} cy={point.y} r="9" fill={color} opacity="0.12" />
                        </g>
                      ))}
                    </g>
                  );
                })}
              </svg>
            </div>

            {tooltip && tooltip.visible && typeof document !== "undefined"
              ? createPortal(
                  <div
                    className="pointer-events-none fixed z-[9999]"
                    style={{
                      left: tooltip.pageX,
                      top: tooltip.pageY,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="relative min-w-[220px] max-w-[260px] rounded-2xl border border-white/70 bg-slate-950/95 text-white shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl overflow-hidden">
                      <div className="h-1.5" style={{ backgroundColor: tooltip.color }} />
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <div className="text-sm font-black tracking-tight">
                              {tooltip.year}년 {tooltip.month}월
                            </div>
                            <div className="text-[11px] text-slate-300 mt-0.5">
                              {dateType === "deposit" ? "입금일 기준" : "방문일 기준"}
                            </div>
                          </div>
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-lg"
                            style={{ backgroundColor: tooltip.color }}
                          >
                            {tooltip.month}월
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                            <div className="text-[10px] font-bold text-slate-300 uppercase mb-1">월 매출</div>
                            <div className="text-sm font-black text-white">{fmt(tooltip.monthTotal)}원</div>
                          </div>
                          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                            <div className="text-[10px] font-bold text-slate-300 uppercase mb-1">월 건수</div>
                            <div className="text-sm font-black text-white">{fmt(tooltip.monthCount)}건</div>
                          </div>
                          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                            <div className="text-[10px] font-bold text-slate-300 uppercase mb-1">누적 매출</div>
                            <div className="text-sm font-black text-white">{fmt(tooltip.cumulativeTotal)}원</div>
                          </div>
                          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                            <div className="text-[10px] font-bold text-slate-300 uppercase mb-1">누적 건수</div>
                            <div className="text-sm font-black text-white">{fmt(tooltip.cumulativeCount)}건</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>,
                  document.body
                )
              : null}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-700 dark:text-zinc-200">월별 누적 표</h3>
          <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
            기준: {dateType === "deposit" ? "입금일" : "방문일"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-zinc-100/80 dark:bg-zinc-800 text-[12px] font-bold text-slate-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-5 py-3">년/월</th>
                {chartMonths.map((month) => (
                  <th key={month} className="px-4 py-3 text-right">{month}월</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {comparison.map((item, index) => (
                <tr key={item.year} className={index % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-800/50"}>
                  <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-zinc-200">
                    {item.year}년
                  </td>
                  {item.cumulativeTotals.map((value, monthIndex) => (
                    <td key={`${item.year}-${monthIndex}`} className="px-4 py-3.5 text-right font-mono font-bold text-slate-700 dark:text-zinc-200">
                      {fmt(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default function SalesComparisonPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">로딩 중...</div>}>
      <ComparisonPageContent />
    </Suspense>
  );
}
