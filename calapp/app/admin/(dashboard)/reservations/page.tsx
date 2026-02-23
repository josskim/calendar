"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type ReservationItem = {
    id: string;
    type: string;
    category: string;
    use_date: string;
    nights: number;
    quantity: number;
    guest_name: string;
    phone: string;
    people_count: number;
    user_type: string;
    total_amount: number;
    extra_amount: number;
    payment_status: string;
    deposit_date: string;
    cancel_date: string;
    source: string;
    memo: string;
    created_at: string;
};

type ListResponse = {
    total: number;
    page: number;
    limit: number;
    items: ReservationItem[];
};

export default function ReservationListPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = 20;

    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/reservations/list?page=${page}&limit=${limit}`);
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                }
            } catch (err) {
                console.error("Failed to fetch list", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [page]);

    const totalPages = data ? Math.ceil(data.total / limit) : 0;

    const formatPhone = (phone: string) => {
        if (phone.length === 11) {
            return phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
        }
        return phone;
    };

    const formatDate = (isoStr: string) => {
        return isoStr.slice(0, 10);
    };

    const handlePageChange = (p: number) => {
        router.push(`/admin/reservations?page=${p}`);
    };

    return (
        <main className="calendar-viewport p-6 max-w-[1400px] mx-auto w-full">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
                    <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 tracking-tight">
                        예약 리스트
                    </h2>
                    <div className="text-sm text-slate-500 font-medium">
                        전체 {data?.total || 0}건
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead>
                            <tr className="bg-zinc-100/80 dark:bg-zinc-800 text-[12px] font-bold text-slate-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
                                <th className="px-4 py-3 text-center">ID</th>
                                <th className="px-4 py-3">방문일</th>
                                <th className="px-4 py-3">예약자명</th>
                                <th className="px-4 py-3">전화번호</th>
                                <th className="px-4 py-3">유형/호실</th>
                                <th className="px-4 py-3 text-center">인원</th>
                                <th className="px-4 py-3 text-center">구분</th>
                                <th className="px-4 py-3 text-right">금액/추가금액</th>
                                <th className="px-4 py-3 text-center">접수경로</th>
                                <th className="px-4 py-3">비고</th>
                                <th className="px-4 py-3 text-center">상태</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-20 text-center text-slate-400 font-medium bg-white dark:bg-zinc-900">
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : data?.items.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-20 text-center text-slate-400 font-medium bg-white dark:bg-zinc-900">
                                        예약 데이터가 없습니다.
                                    </td>
                                </tr>
                            ) : (() => {
                                // 이름+전화번호 기준으로 그룹 컬러 계산
                                let groupIndex = 0;
                                let prevKey = "";
                                const groupMap = (data?.items || []).map((item) => {
                                    const key = `${item.guest_name}__${item.phone}`;
                                    if (key !== prevKey) {
                                        if (prevKey !== "") groupIndex++;
                                        prevKey = key;
                                    }
                                    return groupIndex;
                                });

                                return data?.items.map((item, index) => {
                                    const isCancelled = item.payment_status === "cancelled";
                                    const isEven = groupMap[index] % 2 === 0;
                                    // 그룹별 컬러 (같은 사람은 같은 색, 다른 사람은 반전)
                                    const bgColor = isEven ? "bg-white dark:bg-zinc-900" : "bg-zinc-100 dark:bg-zinc-800";
                                    const textColor = isCancelled ? "text-slate-400 dark:text-zinc-500" : "text-slate-700 dark:text-zinc-200";

                                    const date = new Date(item.use_date);
                                    const year = date.getFullYear();
                                    const month = date.getMonth() + 1;

                                    return (
                                        <tr
                                            key={`${item.id}-${index}`}
                                            className={`
                        border-b border-zinc-50 dark:border-zinc-800/50 transition-colors
                        ${bgColor} ${textColor}
                      `}
                                        >
                                            <td className="px-4 py-3.5 text-center font-mono text-[11px] opacity-70">{item.id}</td>
                                            <td className={`px-4 py-3.5 whitespace-nowrap font-medium ${isCancelled ? "line-through decoration-slate-400" : ""}`}>
                                                <Link
                                                    href={`/admin/calendar?year=${year}&month=${month}`}
                                                    className="hover:text-[#DB5461] transition-colors"
                                                >
                                                    {formatDate(item.use_date)}
                                                </Link>
                                            </td>
                                            <td className={`px-4 py-3.5 font-bold ${isCancelled ? "line-through decoration-slate-400" : ""}`}>
                                                {item.guest_name}
                                            </td>
                                            <td className={`px-4 py-3.5 whitespace-nowrap ${isCancelled ? "line-through decoration-slate-400" : ""}`}>
                                                {formatPhone(item.phone)}
                                            </td>
                                            <td className={`px-4 py-3.5 whitespace-nowrap ${isCancelled ? "line-through decoration-slate-400" : ""}`}>
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold mr-1.5 ${item.type === 'campnic' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/40'}`}>
                                                    {item.type === 'campnic' ? '캠' : '펜'}
                                                </span>
                                                {item.category}
                                            </td>
                                            <td className={`px-4 py-3.5 text-center ${isCancelled ? "line-through decoration-slate-400" : ""}`}>
                                                {item.people_count}명
                                            </td>
                                            <td className={`px-4 py-3.5 text-center ${isCancelled ? "line-through decoration-slate-400" : ""}`}>
                                                <span className={`px-1.5 py-0.5 rounded text-[11px] ${item.user_type === '야수교' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                                    {item.user_type}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3.5 text-right font-mono whitespace-nowrap ${isCancelled ? "line-through decoration-slate-400" : ""}`}>
                                                <span className="font-bold">{item.total_amount.toLocaleString()}</span>
                                                {item.extra_amount > 0 && (
                                                    <>
                                                        <span className="text-slate-300 dark:text-zinc-600 mx-1">/</span>
                                                        <span className="text-slate-400 dark:text-zinc-500 text-[12px]">{item.extra_amount.toLocaleString()}</span>
                                                    </>
                                                )}
                                            </td>
                                            <td className={`px-4 py-3.5 text-center ${isCancelled ? "line-through decoration-slate-400" : ""}`}>
                                                {item.source === 'naver' ? '네이버' : item.source === 'phone' ? '전화' : item.source === 'nol' ? '놀' : item.source === 'here' ? '여기' : '기타'}
                                            </td>
                                            <td className="px-4 py-3.5 relative group">
                                                <div className="max-w-[150px] truncate">
                                                    <span className={isCancelled ? "line-through decoration-slate-400" : ""}>
                                                        {item.memo || "-"}
                                                    </span>
                                                </div>
                                                {item.memo && (() => {
                                                    // 첫 3행은 아래로, 나머지는 위로 툴팁 표시 (overflow-hidden 클리핑 방지)
                                                    const showBelow = index < 3;
                                                    return (
                                                        <div className={`absolute left-1/2 -translate-x-1/2 hidden group-hover:flex group-hover:flex-col z-[200] w-72 max-w-xs pointer-events-none ${showBelow ? "top-full mt-2" : "bottom-full mb-2"}`}>
                                                            {showBelow && (
                                                                // 아래로 툴팁 → 꼬리는 위(마우스 방향)
                                                                <div className="self-center w-4 h-4 bg-amber-50 dark:bg-amber-900 border-l-2 border-t-2 border-amber-200 dark:border-amber-700/50 rotate-45 -mb-2 flex-shrink-0" />
                                                            )}
                                                            <div className="bg-amber-50 dark:bg-amber-900/95 text-amber-900 dark:text-amber-50 text-xs font-medium rounded-xl shadow-2xl border-2 border-amber-200 dark:border-amber-700/50 whitespace-normal break-all p-4">
                                                                <div className="flex items-center gap-2 font-black border-b border-amber-200 dark:border-amber-700/50 pb-2 mb-2 text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                                                                    <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                                                    비고 상세 내용
                                                                </div>
                                                                <div className="leading-relaxed">
                                                                    {item.memo}
                                                                </div>
                                                            </div>
                                                            {!showBelow && (
                                                                // 위로 툴팁 → 꼬리는 아래(마우스 방향)
                                                                <div className="self-center w-4 h-4 bg-amber-50 dark:bg-amber-900 border-r-2 border-b-2 border-amber-200 dark:border-amber-700/50 rotate-45 -mt-2 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                {isCancelled ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-red-500 font-bold text-[11px]">취소됨</span>
                                                        <span className="text-[10px] text-slate-400">{formatDate(item.cancel_date)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-emerald-500 font-bold text-[11px]">확정</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            })()}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-2">
                    <button
                        onClick={() => handlePageChange(Math.max(1, page - 1))}
                        disabled={page === 1 || loading}
                        className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 disabled:opacity-30 transition-all font-bold text-slate-500"
                    >
                        이전
                    </button>

                    <div className="flex items-center gap-1">
                        {(() => {
                            const pages = [];
                            const maxVisible = 5;
                            let start = Math.max(1, page - 2);
                            let end = Math.min(totalPages, start + maxVisible - 1);

                            if (end - start + 1 < maxVisible) {
                                start = Math.max(1, end - maxVisible + 1);
                            }

                            for (let i = start; i <= end; i++) {
                                pages.push(i);
                            }

                            return pages.map((pageNum) => (
                                <button
                                    key={pageNum}
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`
                                        w-9 h-9 rounded-lg text-sm font-bold transition-all
                                        ${page === pageNum
                                            ? "bg-[#DB5461] text-white shadow-md shadow-rose-200 dark:shadow-none"
                                            : "text-slate-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"}
                                    `}
                                >
                                    {pageNum}
                                </button>
                            ));
                        })()}
                    </div>

                    <button
                        onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages || loading}
                        className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 disabled:opacity-30 transition-all font-bold text-slate-500"
                    >
                        다음
                    </button>
                </div>
            </div>
        </main>
    );
}
