"use client";

import { Suspense, useEffect, useState, useRef } from "react";
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

function ReservationListPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = 20;

    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const search = searchParams.get("search") || "";
    const [searchInput, setSearchInput] = useState(search);

    // Sync States
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [syncResults, setSyncResults] = useState<{ missing: any[], totalChecked: number } | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
                const res = await fetch(`/api/admin/reservations/list?page=${page}&limit=${limit}${searchParam}`);
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
    }, [page, search]);

    const handleSyncClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSyncing(true);
        setSyncResults(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const buffer = event.target?.result as ArrayBuffer;
            let content;
            try {
                // 1. Try UTF-8 (Strict)
                content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
            } catch (e) {
                // 2. If failed, fallback to EUC-KR (ANSI/CP949)
                content = new TextDecoder("euc-kr").decode(buffer);
            }
            processCSV(content);
        };
        reader.readAsArrayBuffer(file);
        // Reset input
        e.target.value = "";
    };

    const processCSV = async (csvText: string) => {
        try {
            const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) throw new Error("데이터가 부족합니다.");

            // 1. 헤더 행 찾기 및 구분자 감지
            let headerIdx = -1;
            let delimiter = ",";
            const sample = lines.slice(0, 5).join("\n");
            if (sample.includes("\t")) delimiter = "\t";
            else if (sample.includes(";") && !sample.includes(",")) delimiter = ";";

            const allRows = lines.map(line => {
                const cols = [];
                let current = "";
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') inQuotes = !inQuotes;
                    else if (char === delimiter && !inQuotes) { cols.push(current.trim()); current = ""; }
                    else current += char;
                }
                cols.push(current.trim());
                return cols.map(c => c.replace(/^"|"$/g, "").trim());
            });

            for (let i = 0; i < allRows.length; i++) {
                const row = allRows[i];
                const rowStr = row.join("|").replace(/\s/g, ""); // 공백 제거 후 비교 (예약 번호 -> 예약번호)

                // 예약번호가 있거나, 통합예약번호가 있거나, (예약자/이름 + 상태/체크인/입실) 조합이 있는 행을 헤더로 간주
                const hasBooking = rowStr.includes("예약번호") || rowStr.includes("통합예약번호");
                const hasName = rowStr.includes("예약자") || rowStr.includes("이름") || rowStr.includes("고객");
                const hasStatus = rowStr.includes("상태") || rowStr.includes("체크인") || rowStr.includes("입실");

                if (hasBooking || (hasName && hasStatus)) {
                    headerIdx = i;
                    break;
                }
            }

            if (headerIdx === -1) {
                alert("CSV 헤더를 찾을 수 없습니다. (예약번호, 상태, 예약자 컬럼 확인)");
                setIsSyncing(false);
                return;
            }

            const headers = allRows[headerIdx];
            const rows = allRows.slice(headerIdx + 1);

            // indices (Support both Naver and Nol with loose matching)
            const findIdx = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

            const hIdx = {
                status: findIdx(["상태", "예약상태", "구분", "통합예약번호"]), // 여기어때는 통합예약번호를 상태 대용으로도 체크
                name: findIdx(["예약자", "예약자명", "이름", "성함", "고객명"]),
                phone: findIdx(["전화번호", "휴대폰번호", "휴대폰", "연락처", "핸드폰"]),
                period: findIdx(["이용기간", "체크인", "체크인일자", "사용일", "이용일", "투숙일", "숙박일", "입실일", "입실 일시"]),
                room: findIdx(["상품명", "객실", "상품/객실명", "객실명", "숙소"]),
                amount: findIdx(["결제금액", "실제결제금액", "판매금액", "판매가", "판매 금액", "총결제금액", "총액"]),
                cancel: findIdx(["취소 일시", "예약취소일시", "예약 취소 일시", "취소날짜", "취소일"])
            };

            if (hIdx.name === -1 || hIdx.period === -1 || (hIdx.status === -1 && hIdx.phone === -1)) {
                alert(`필수 정보를 찾을 수 없습니다.\n\n확인된 헤더: ${headers.join(", ")}\n\n(예약자, 이용일, 연락처 관련 컬럼이 있는지 확인해주세요.)`);
                setIsSyncing(false);
                return;
            }

            const relevantRows = rows.filter(row => {
                const s = (row[hIdx.status] || "").trim();
                const cancelVal = hIdx.cancel !== -1 ? (row[hIdx.cancel] || "").trim() : "";
                // 상태에 '취소'가 있거나 취소일시 값이 있으면 포함 (UI에서 표시하기 위함)
                return s.includes("확정") || s.includes("완료") || s.includes("취소") || cancelVal !== "" || (s.includes("대기") === false && s !== "");
            });
            if (relevantRows.length === 0) {
                setSyncResults({ missing: [], totalChecked: 0 });
                return;
            }

            // 2. 대조를 위해 전체 예약 데이터 (필요한 만큼) 가져오기
            // 현재 페이지만으로는 부족하므로, 충분히 큰 limit으로 다시 요청하거나 전용 API가 필요함.
            // 여기서는 기존 API를 활용해 5000건 정도를 가져와 대조용으로 사용 (일반적인 펜션 규모 커버)
            const lookupRes = await fetch(`/api/admin/reservations/list?page=1&limit=5000`);
            let allItems: ReservationItem[] = [];
            if (lookupRes.ok) {
                const lookupData = await lookupRes.json();
                allItems = lookupData.items || [];
            } else {
                allItems = data?.items || []; // 실패 시 현재 페이지만이라도 사용
            }

            const missing: any[] = [];

            relevantRows.forEach(row => {
                const nName = (row[hIdx.name] || "").trim();
                const nPhone = (row[hIdx.phone] || "").replace(/\D/g, "").slice(-4);
                const nAmount = hIdx.amount !== -1 ? (row[hIdx.amount] || "").replace(/\D/g, "") : "";

                const sStr = (row[hIdx.status] || "").trim();
                const cStr = hIdx.cancel !== -1 ? (row[hIdx.cancel] || "").trim() : "";
                const isCancelled = sStr.includes("취소") || (cStr !== "" && cStr !== "-");

                // 3. 날짜 파싱
                const periodStr = row[hIdx.period] || "";
                let nDate = "";

                // Naver/Normal format: "26. 3. 18.(수)~..." or "2026-03-18" or "26.03.18"
                const dateMatch = periodStr.match(/(\d{2,4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
                if (dateMatch) {
                    let yy = dateMatch[1];
                    if (yy.length === 2) yy = `20${yy}`;
                    const mm = dateMatch[2].padStart(2, '0');
                    const dd = dateMatch[3].padStart(2, '0');
                    nDate = `${yy}-${mm}-${dd}`;
                } else {
                    return; // 날짜 파싱 실패 시 무시
                }

                const nRoomOrig = row[hIdx.room] || "";

                // Determine target rooms
                let targetRooms = [];
                if (nRoomOrig.includes("101호")) targetRooms.push("101호");
                if (nRoomOrig.includes("201호") || nRoomOrig.includes("202호") || nRoomOrig.includes("독체")) {
                    if (nRoomOrig.includes("독체") || (nRoomOrig.includes("201호") && nRoomOrig.includes("202호"))) {
                        targetRooms.push("201호", "202호");
                    } else if (nRoomOrig.includes("201호")) {
                        targetRooms.push("201호");
                    } else if (nRoomOrig.includes("202호")) {
                        targetRooms.push("202호");
                    }
                }

                if (targetRooms.length === 0) return;

                targetRooms.forEach(room => {
                    const found = allItems.find(item => {
                        const iDate = item.use_date.slice(0, 10);
                        const iPhone = item.phone.replace(/\D/g, "").slice(-4);
                        const iName = (item.guest_name || "").trim();
                        const iIsCancelled = item.payment_status === "cancelled";

                        const isDateMatch = iDate === nDate;
                        const isPhoneMatch = iPhone === nPhone && nPhone !== "";
                        const isRoomMatch = item.category === room;
                        const isCancelStatusMatch = iIsCancelled === isCancelled;

                        // 이름 매칭: 여기어때 "맹*혁" 대응 (글자수가 같고 성과 끝자가 같으면 매칭 시도)
                        let isNameMatch = iName === nName;
                        if (!isNameMatch && nName.includes("*") && nName.length === iName.length) {
                            const first = nName[0];
                            const last = nName[nName.length - 1];
                            if (iName.startsWith(first) && iName.endsWith(last)) {
                                isNameMatch = true;
                            }
                        }

                        // 전화번호 + 날짜 + 호실이 맞으면 이름이 마스킹되어도 매칭된 것으로 간주
                        return isDateMatch && isPhoneMatch && isRoomMatch && isCancelStatusMatch && (isNameMatch || nName.includes("*"));
                    });

                    if (!found) {
                        missing.push({
                            name: nName,
                            phone: row[hIdx.phone],
                            date: nDate,
                            room: room,
                            amount: nAmount,
                            origRoom: nRoomOrig,
                            isCancelled: isCancelled
                        });
                    }
                });
            });

            setSyncResults({ missing, totalChecked: relevantRows.length });
        } catch (err) {
            console.error("Sync error", err);
            alert("파일 분석 중 오류가 발생했습니다.");
        } finally {
            setIsSyncing(false);
        }
    };

    const totalPages = data ? Math.ceil(data.total / limit) : 0;
    const items = data?.items || [];

    const formatPhone = (phone: string) => {
        if (phone.length === 11) {
            return phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
        } else if (phone.length === 12) {
            return phone.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3");
        }
        return phone;
    };

    const formatDate = (isoStr: string) => {
        return isoStr.slice(0, 10);
    };

    const handlePageChange = (p: number) => {
        const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
        router.push(`/admin/reservations?page=${p}${searchParam}`);
    };

    const handleSearch = () => {
        router.push(`/admin/reservations?page=1&search=${encodeURIComponent(searchInput)}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    return (
        <main className="calendar-viewport p-6 max-w-[1400px] mx-auto w-full">
            {/* Sync Results Alert */}
            {syncResults && (
                <div className="mb-6 p-4 bg-white dark:bg-zinc-900 border-2 border-[#DB5461] rounded-xl shadow-lg animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#DB5461] animate-pulse" />
                            <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100">
                                네이버/야놀자/여기어때 예약 대조 결과 ({syncResults.totalChecked}개 분석 중)
                            </h3>
                        </div>
                        <button onClick={() => setSyncResults(null)} className="text-zinc-400 hover:text-zinc-600 text-sm font-bold">✕ 닫기</button>
                    </div>
                    {syncResults.missing.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-[#DB5461] mb-2 px-1">
                                ⚠️ 현재 페이지 데이터 기준으로 아래 {syncResults.missing.length}건이 캘린더에 없습니다.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {syncResults.missing.map((res, i) => (
                                    <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800 flex flex-col gap-1 ring-1 ring-[#DB5461]/20">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[13px] font-black text-slate-800 dark:text-zinc-100">{res.name}</span>
                                            <div className="flex gap-1 items-center">
                                                {res.isCancelled && (
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">취소</span>
                                                )}
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DB5461]/10 text-[#DB5461]">{res.room}</span>
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-medium">이용일: {res.date}</div>
                                        <div className="text-[11px] text-slate-500 font-medium">연락처: {res.phone}</div>
                                        <div className="mt-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50 flex justify-end">
                                            <Link
                                                href={`/admin/calendar?date=${res.date}&name=${encodeURIComponent(res.name)}&phone=${res.phone}&room=${encodeURIComponent(res.room)}&amount=${res.amount}`}
                                                target="_blank"
                                                className="text-[10px] font-bold text-slate-500 hover:text-[#DB5461] transition-colors"
                                            >
                                                캘린더에서 등록 →
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs font-bold text-emerald-500 px-1 py-10 text-center">
                            ✨ 현재 페이지의 모든 네이버/야놀자 예약이 캘린더에 정상 등록되어 있습니다.
                        </p>
                    )}
                </div>
            )}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="relative px-6 py-5 pr-[520px] border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur sticky top-0 z-30">
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3 w-[480px]">
                        <button
                            onClick={handleSyncClick}
                            disabled={isSyncing}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg bg-[#DB5461] text-white font-black text-[11px] hover:bg-[#c44350] transition-colors shadow-sm disabled:opacity-50 h-9`}
                        >
                            {isSyncing ? "분석 중..." : "네이버/야놀자/여기어때 누락 확인"}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".csv"
                            className="hidden"
                        />
                        <div className="flex-grow flex gap-2">
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="이름, 번호, 호실 등 검색..."
                                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#DB5461]/30 focus:border-[#DB5461]"
                            />
                            <button
                                onClick={handleSearch}
                                className="px-4 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-white font-bold text-[12px] hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors shadow-sm h-9 flex-shrink-0"
                            >
                                검색
                            </button>
                        </div>
                    </div>
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
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-20 text-center text-slate-400 font-medium bg-white dark:bg-zinc-900">
                                        예약 데이터가 없습니다.
                                    </td>
                                </tr>
                            ) : (() => {
                                // 이름+전화번호 기준으로 그룹 컬러 계산
                                let groupIndex = 0;
                                let prevKey = "";
                                const groupMap = items.map((item) => {
                                    const key = `${item.guest_name}__${item.phone}`;
                                    if (key !== prevKey) {
                                        if (prevKey !== "") groupIndex++;
                                        prevKey = key;
                                    }
                                    return groupIndex;
                                });

                                    return items.map((item, index) => {
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
                                                {item.source === 'naver' ? '네이버' : item.source === 'phone' ? '전화' : item.source === 'nol' ? '놀' : item.source === 'here' ? '여기' : item.source === 'airbnb' ? '에어비앤비' : '기타'}
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

export default function ReservationListPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center text-slate-400">Loading...</div>}>
            <ReservationListPageContent />
        </Suspense>
    );
}
