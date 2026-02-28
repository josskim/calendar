"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type MonthData = {
    month: number;
    count: number;
    total: number;
    pension: number;
    campnic: number;
    extra: number;
};

type YearlyData = {
    count: number;
    total: number;
    pension: number;
    campnic: number;
    extra: number;
};

type UnsettledData = {
    naver: number;
    nol: number;
    here: number;
    airbnb: number;
    phone: number;
    other: number;
    total: number;
};

type SalesResponse = {
    year: number;
    yearly: YearlyData;
    months: MonthData[];
    unsettled: UnsettledData;
};

const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function fmt(n: number) {
    return (n || 0).toLocaleString();
}

function SalesPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const MIN_YEAR = 2024;
    const MAX_YEAR = 2026;
    const currentYear = new Date().getFullYear();
    const initialYearRaw = parseInt(searchParams.get("year") || currentYear.toString(), 10);
    const initialYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, initialYearRaw));
    const [year, setYear] = useState(initialYear);
    const [data, setData] = useState<SalesResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (y: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/sales/yearly?year=${y}`);
            if (res.ok) setData(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(year);
    }, [year, fetchData]);

    const handleYearChange = (y: number) => {
        const nextYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, y));
        setYear(nextYear);
        router.replace(`/admin/sales?year=${nextYear}`);
    };

    // 차트 계산
    const months = data?.months || [];
    const maxTotal = Math.max(...months.map(m => m.total), 1);

    const yearOptions = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

    const yearly = data?.yearly;

    return (
        <main className="calendar-viewport p-6 max-w-[1400px] mx-auto w-full">

            {/* 연도 네비게이션 */}
            <div className="flex items-center justify-center gap-4 mb-8">
                <button
                    onClick={() => handleYearChange(year - 1)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-[#DB5461] hover:border-[#DB5461]/40 font-bold text-sm transition-all shadow-sm"
                >
                    ← 이전
                </button>
                <select
                    value={year}
                    onChange={(e) => handleYearChange(parseInt(e.target.value))}
                    className="px-5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 font-black text-lg cursor-pointer shadow-sm focus:outline-none focus:border-[#DB5461] focus:ring-1 focus:ring-[#DB5461]/30"
                >
                    {yearOptions.map(y => (
                        <option key={y} value={y}>{y}년</option>
                    ))}
                </select>
                <button
                    onClick={() => handleYearChange(year + 1)}
                    disabled={year >= MAX_YEAR}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-[#DB5461] hover:border-[#DB5461]/40 font-bold text-sm transition-all shadow-sm"
                >
                    다음 →
                </button>
            </div>

            {/* 요약 통계 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">총 매출</div>
                    <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">
                        {loading ? "—" : `${fmt(yearly?.total ?? 0)}`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">원</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                    <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">팬션 매출</div>
                    <div className="text-2xl font-black text-rose-500">
                        {loading ? "—" : `${fmt(yearly?.pension ?? 0)}`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">원</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">캠프닉 매출</div>
                    <div className="text-2xl font-black text-indigo-500">
                        {loading ? "—" : `${fmt(yearly?.campnic ?? 0)}`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">원</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">총 예약건수</div>
                    <div className="text-2xl font-black text-emerald-500">
                        {loading ? "—" : `${fmt(yearly?.count ?? 0)}`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">건</div>
                </div>
            </div>

            {/* 미정산 금액 (오늘 이후) */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="w-1.5 h-4 bg-[#DB5461] rounded-full" />
                    <h3 className="text-sm font-black text-slate-700 dark:text-zinc-300">플랫폼별 정산 예정액 (오늘 이후 예약 전체)</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm border-l-4 border-l-emerald-500">
                        <div className="text-[10px] font-bold text-emerald-500/80 mb-1">네이버</div>
                        <div className="text-sm font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : fmt(data?.unsettled?.naver ?? 0)}</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm border-l-4 border-l-rose-500">
                        <div className="text-[10px] font-bold text-rose-500/80 mb-1">야놀자</div>
                        <div className="text-sm font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : fmt(data?.unsettled?.nol ?? 0)}</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm border-l-4 border-l-rose-600">
                        <div className="text-[10px] font-bold text-rose-600/80 mb-1">여기어때</div>
                        <div className="text-sm font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : fmt(data?.unsettled?.here ?? 0)}</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm border-l-4 border-l-rose-400">
                        <div className="text-[10px] font-bold text-rose-400/80 mb-1">에어비앤비</div>
                        <div className="text-sm font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : fmt(data?.unsettled?.airbnb ?? 0)}</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm border-l-4 border-l-slate-400">
                        <div className="text-[10px] font-bold text-slate-400 mb-1">전화/기타</div>
                        <div className="text-sm font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : fmt((data?.unsettled?.phone ?? 0) + (data?.unsettled?.other ?? 0))}</div>
                    </div>
                    <div className="bg-zinc-800 dark:bg-zinc-800 rounded-xl border border-zinc-700 p-3 shadow-md border-l-4 border-l-[#DB5461]">
                        <div className="text-[10px] font-bold text-zinc-400 mb-1">총 예정액</div>
                        <div className="text-sm font-black text-white">{loading ? "—" : fmt(data?.unsettled?.total ?? 0)}</div>
                    </div>
                </div>
            </div>

            {/* 월별 바 차트 */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-8 shadow-sm">
                <h3 className="text-base font-black text-slate-700 dark:text-zinc-200 mb-6">
                    {year}년 월별 매출 현황
                </h3>
                {loading ? (
                    <div className="h-56 flex items-center justify-center text-slate-300 text-sm">데이터 로딩 중...</div>
                ) : (
                    <div className="flex items-end gap-2 h-64">
                        {MONTH_LABELS.map((label, i) => {
                            const m = months.find(x => x.month === i + 1);
                            const pension = m?.pension ?? 0;
                            const campnic = m?.campnic ?? 0;
                            const total = m?.total ?? 0;
                            const barH = total === 0 ? 0 : Math.max(4, Math.round((total / maxTotal) * 200));
                            const pensionH = total === 0 ? 0 : Math.round((pension / total) * barH);
                            const campnicH = barH - pensionH;

                            return (
                                <div key={label} className="flex-1 flex flex-col items-center gap-1.5 group">
                                    {/* 금액 레이블 */}
                                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-center whitespace-nowrap">
                                        {total > 0 ? `${fmt(Math.round(total / 10000))}만` : ""}
                                    </div>
                                    {/* 스택 바 */}
                                    <div className="w-full flex flex-col justify-end rounded-lg overflow-hidden" style={{ height: 200 }}>
                                        <div
                                            className="w-full bg-indigo-400 dark:bg-indigo-500 transition-all duration-700 ease-out"
                                            style={{ height: campnicH }}
                                            title={`캠프닉: ${fmt(campnic)}원`}
                                        />
                                        <div
                                            className="w-full bg-rose-400 dark:bg-rose-500 transition-all duration-700 ease-out"
                                            style={{ height: pensionH }}
                                            title={`팬션: ${fmt(pension)}원`}
                                        />
                                    </div>
                                    {/* 월 레이블 */}
                                    <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">{label}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {/* 범례 */}
                <div className="flex items-center gap-5 mt-4 justify-center">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-rose-400" />
                        <span className="text-xs text-slate-500 font-medium">팬션</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-indigo-400" />
                        <span className="text-xs text-slate-500 font-medium">캠프닉</span>
                    </div>
                </div>
            </div>

            {/* 월별 데이터 테이블 */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <h3 className="text-base font-black text-slate-700 dark:text-zinc-200">월별 상세 내역</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-100/80 dark:bg-zinc-800 text-[12px] font-bold text-slate-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
                                <th className="px-5 py-3">년/월</th>
                                <th className="px-5 py-3 text-center">예약건수</th>
                                <th className="px-5 py-3 text-right">총매출</th>
                                <th className="px-5 py-3 text-right">팬션매출</th>
                                <th className="px-5 py-3 text-right">캠프닉매출</th>
                                <th className="px-5 py-3 text-right">총추가금액</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-16 text-center text-slate-400">로딩 중...</td>
                                </tr>
                            ) : MONTH_LABELS.map((label, i) => {
                                const m = months.find(x => x.month === i + 1);
                                const isEven = i % 2 === 0;
                                const hasData = (m?.total ?? 0) > 0;
                                return (
                                    <tr
                                        key={label}
                                        className={`border-b border-zinc-50 dark:border-zinc-800/50 ${isEven ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-800/60"} ${!hasData ? "opacity-50" : ""}`}
                                    >
                                        <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-zinc-200">
                                            {year}년 {label}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            {hasData ? (
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded font-bold text-xs">
                                                    {m?.count ?? 0}건
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-700 dark:text-zinc-200">
                                            {hasData ? fmt(m?.total ?? 0) : <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono text-rose-500">
                                            {(m?.pension ?? 0) > 0 ? fmt(m?.pension ?? 0) : <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono text-indigo-500">
                                            {(m?.campnic ?? 0) > 0 ? fmt(m?.campnic ?? 0) : <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono text-slate-400 dark:text-zinc-500">
                                            {(m?.extra ?? 0) > 0 ? fmt(m?.extra ?? 0) : <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {/* 합계 행 */}
                        {!loading && yearly && (
                            <tfoot>
                                <tr className="bg-slate-800 dark:bg-zinc-700 text-white text-[13px] font-bold border-t-2 border-slate-700">
                                    <td className="px-5 py-4">합계</td>
                                    <td className="px-5 py-4 text-center text-emerald-300">{fmt(yearly.count)}건</td>
                                    <td className="px-5 py-4 text-right font-mono text-white">{fmt(yearly.total)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-rose-300">{fmt(yearly.pension)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-indigo-300">{fmt(yearly.campnic)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-slate-300">{fmt(yearly.extra)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </main>
    );
}

export default function SalesPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center text-slate-400">로딩 중...</div>}>
            <SalesPageContent />
        </Suspense>
    );
}
