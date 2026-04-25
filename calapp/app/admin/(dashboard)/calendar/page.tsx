"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  AddIcon,
} from "./CalIcons";
import { ReservationModal } from "./ReservationModal";
import { Phone, HelpCircle } from "lucide-react";

type CellDay = {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  iso: string;
};

type HolidayEntry = {
  date: string;
  name: string;
  source: "default" | "custom";
  id: number;
};

type HolidayEditTarget = {
  id: number;
} | null;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

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
  dateType: "visit" | "deposit";
};

function fmt(n: number) {
  return (n || 0).toLocaleString();
}

/** code.html과 동일한 고정 예약 슬롯 (모든 날짜 공통). 첫 번째는 예약 완료(키 컬러). */
const FIXED_SLOTS = [
  { label: "201호", type: "pension" },
  { label: "202호", type: "pension" },
  { label: "101호", type: "pension" },
  { label: "캠프닉1부", type: "campnic" },
  { label: "캠프닉2부", type: "campnic" },
];

const SourceIcon = ({ source }: { source: string }) => {
  switch (source) {
    case "phone":
      return <Phone size={9} className="opacity-80" />;
    case "naver":
      return (
        <span className="w-2.5 h-2.5 bg-[#03C75A] text-white flex items-center justify-center text-[7px] font-black rounded-[1px] shrink-0">
          N
        </span>
      );
    case "nol": // 야놀자
      return (
        <span className="px-0.5 min-w-[14px] h-2.5 bg-[#FF3478] text-white flex items-center justify-center text-[7px] font-black rounded-[1px] shrink-0">
          Nol
        </span>
      );
    case "here": // 여기어때
      return (
        <span className="px-0.5 min-w-[12px] h-2.5 bg-[#f2134d] text-white flex items-center justify-center text-[7px] font-black rounded-[1px] shrink-0 text-center">
          gi
        </span>
      );
    case "airbnb":
      return (
        <span className="px-0.5 min-w-[12px] h-2.5 bg-[#FF5A5F] text-white flex items-center justify-center text-[7px] font-black rounded-[1px] shrink-0">
          Air
        </span>
      );
    case "other":
    default:
      return <HelpCircle size={9} className="opacity-80" />;
  }
};

function buildCalendarCells(year: number, month: number): CellDay[] {
  const getLocalIsoDate = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  };

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: CellDay[] = [];
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevLast = new Date(prevYear, prevMonth, 0);
  const prevDays = prevLast.getDate();

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(prevYear, prevMonth - 1, prevDays - i);
    const iso = getLocalIsoDate(d);
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    cells.push({
      date: d,
      day: prevDays - i,
      isCurrentMonth: false,
      isToday: t.getTime() === today.getTime(),
      iso,
    });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month - 1, i);
    const iso = getLocalIsoDate(d);
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    cells.push({
      date: d,
      day: i,
      isCurrentMonth: true,
      isToday: t.getTime() === today.getTime(),
      iso,
    });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month, i);
    const iso = getLocalIsoDate(d);
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    cells.push({
      date: d,
      day: i,
      isCurrentMonth: false,
      isToday: t.getTime() === today.getTime(),
      iso,
    });
  }
  return cells;
}

function CalendarContent() {
  const today = new Date();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialYear = parseInt(searchParams.get("year") || today.getFullYear().toString(), 10);
  const initialMonth = parseInt(searchParams.get("month") || (today.getMonth() + 1).toString(), 10);

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  // URL 파라미터가 변경될 때 상태 업데이트
  useEffect(() => {
    const yr = searchParams.get("year");
    const mo = searchParams.get("month");
    if (yr) setYear(parseInt(yr, 10));
    if (mo) setMonth(parseInt(mo, 10));
  }, [searchParams]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string | undefined>();
  const [modalDefaultCategory, setModalDefaultCategory] = useState<string | undefined>();
  const [modalSelectedReservation, setModalSelectedReservation] = useState<any | undefined>();
  const [modalDayReservations, setModalDayReservations] = useState<any[]>([]);
  const [reservationsByDate, setReservationsByDate] = useState<Record<string, any[]>>({});
  const [focusedIsoDate, setFocusedIsoDate] = useState<string | null>(null);
  const [salesDateType, setSalesDateType] = useState<"visit" | "deposit">("visit");
  const [salesData, setSalesData] = useState<SalesResponse | null>(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [holidayEntriesData, setHolidayEntriesData] = useState<HolidayEntry[]>([]);
  const [holidayDateInput, setHolidayDateInput] = useState("");
  const [holidayNameInput, setHolidayNameInput] = useState("");
  const [holidayEditTarget, setHolidayEditTarget] = useState<HolidayEditTarget>(null);

  const cells = buildCalendarCells(year, month);

  const fetchReservations = async () => {
    try {
      const res = await fetch(`/api/admin/reservations?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        const grouped: Record<string, any[]> = {};
        for (const r of data) {
          const iso = r.use_date.slice(0, 10);
          if (!grouped[iso]) grouped[iso] = [];
          grouped[iso].push(r);
        }
        setReservationsByDate(grouped);
      }
    } catch (e) {
      console.error("Failed to fetch reservations", e);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [year, month]);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await fetch("/api/admin/holidays");
        if (!res.ok) return;
        const holidays = await res.json();
        setHolidayEntriesData(
          Array.isArray(holidays)
            ? holidays
                .filter((item) => item && typeof item.id === "number" && typeof item.date === "string" && typeof item.name === "string")
                .map((item) => ({
                  id: item.id,
                  date: item.date,
                  name: item.name,
                  source: item.source === "default" ? "default" : "custom",
                }))
            : []
        );
      } catch (error) {
        console.error("Failed to load holidays", error);
      }
    };

    fetchHolidays();
  }, []);

  useEffect(() => {
    const fetchSales = async () => {
      setSalesLoading(true);
      try {
        const res = await fetch(`/api/admin/sales/yearly?year=${year}&dateType=${salesDateType}`);
        if (res.ok) {
          setSalesData(await res.json());
        }
      } catch (e) {
        console.error("Failed to fetch sales data", e);
      } finally {
        setSalesLoading(false);
      }
    };

    fetchSales();
  }, [year, salesDateType]);

  // Sync 연동: URL 파라미터가 있으면 모달 자동 오픈
  useEffect(() => {
    const qDate = searchParams.get("date");
    const qName = searchParams.get("name");
    const qPhone = searchParams.get("phone");
    const qRoom = searchParams.get("room");
    const qAmount = searchParams.get("amount");

    if (qDate && qName && qPhone && qRoom) {
      // 데이터가 이미 로드되었거나 최소한 빈 객체라도 생성되었을 때 실행
      const targetYear = new Date(qDate).getFullYear();
      const targetMonth = new Date(qDate).getMonth() + 1;

      // 현재 보고 있는 달이 아니라면 이동 후 대기
      if (targetYear !== year || targetMonth !== month) {
        setYear(targetYear);
        setMonth(targetMonth);
        return;
      }

      // 모달이 닫혀있고 데이터 로딩이 끝난 시점에 오픈
      if (!modalOpen && Object.keys(reservationsByDate).length > 0) {
        openModal(qDate, qRoom, {
          guest_name: qName,
          phone: qPhone,
          category: qRoom,
          use_date: qDate,
          source: "naver",
          payment_status: "confirmed",
          total_amount: qAmount ? parseInt(qAmount, 10) : "",
          type: qRoom.includes("캠프닉") ? "campnic" : "pension"
        });
        // 파라미터 제거 (뒤로가기 시 중복 방지)
        const params = new URLSearchParams(searchParams.toString());
        params.delete("date");
        params.delete("name");
        params.delete("phone");
        params.delete("room");
        params.delete("amount");
        router.replace(`/admin/calendar?${params.toString()}`);
      }
    }
  }, [searchParams, year, month, reservationsByDate, modalOpen]);

  useEffect(() => {
    if (!focusedIsoDate) return;

    const highlightedCell = document.querySelector<HTMLElement>(`[data-cell-iso="${focusedIsoDate}"]`);
    if (highlightedCell) {
      highlightedCell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }

    const timer = window.setTimeout(() => {
      setFocusedIsoDate(null);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [focusedIsoDate, reservationsByDate, year, month]);

  const goPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
  };

  const openModal = (iso?: string, category?: string, initialData?: any) => {
    setModalDefaultDate(iso);
    setModalDefaultCategory(category);
    setModalSelectedReservation(initialData);

    // 해당 날짜의 전체 예약 리스트 추출
    if (iso) {
      setModalDayReservations(reservationsByDate[iso] || []);
    } else {
      setModalDayReservations([]);
    }

    setModalOpen(true);
  };

  const handleSaveSuccess = async (saved?: { use_date?: string }) => {
    const savedUseDate = saved?.use_date?.slice(0, 10);
    if (!savedUseDate) {
      await fetchReservations();
      return;
    }

    const savedDate = new Date(savedUseDate);
    const targetYear = savedDate.getFullYear();
    const targetMonth = savedDate.getMonth() + 1;

    setFocusedIsoDate(savedUseDate);

    if (targetYear !== year || targetMonth !== month) {
      setYear(targetYear);
      setMonth(targetMonth);
      router.replace(`/admin/calendar?year=${targetYear}&month=${targetMonth}`);
      return;
    }

    await fetchReservations();
  };

  const monthNames = [
    "1월", "2월", "3월", "4월", "5월", "6월",
    "7월", "8월", "9월", "10월", "11월", "12월",
  ];
  const salesMonths = salesData?.months || [];
  const salesMaxTotal = Math.max(...salesMonths.map((m) => m.total), 1);
  const salesYearly = salesData?.yearly;
  const holidayEntries = useMemo(() => {
    const map = new Map<string, HolidayEntry[]>();

    for (const entry of holidayEntriesData) {
      if (!map.has(entry.date)) map.set(entry.date, []);
      map.get(entry.date)!.push(entry);
    }

    return map;
  }, [holidayEntriesData]);

  const currentMonthHolidays = useMemo(() => {
    return cells
      .filter((cell) => cell.isCurrentMonth)
      .flatMap((cell) => (holidayEntries.get(cell.iso) || []).map((holiday) => ({
        ...holiday,
        iso: cell.iso,
      })));
  }, [cells, holidayEntries]);

  const refreshHolidays = async () => {
    const res = await fetch("/api/admin/holidays");
    if (!res.ok) return;
    const holidays = await res.json();
    setHolidayEntriesData(
      Array.isArray(holidays)
        ? holidays.map((item) => ({
            id: item.id,
            date: item.date,
            name: item.name,
            source: item.source === "default" ? "default" : "custom",
          }))
        : []
    );
  };

  const addHoliday = async () => {
    if (!holidayDateInput || !holidayNameInput.trim()) return;
    try {
      const url = holidayEditTarget ? `/api/admin/holidays/${holidayEditTarget.id}` : "/api/admin/holidays";
      const method = holidayEditTarget ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: holidayDateInput,
          name: holidayNameInput.trim(),
        }),
      });

      if (!res.ok) return;
      await refreshHolidays();
    } catch (error) {
      console.error("Failed to save holiday", error);
    }

    setHolidayDateInput("");
    setHolidayNameInput("");
    setHolidayEditTarget(null);
  };

  const startEditHoliday = (holiday: HolidayEntry) => {
    setHolidayDateInput(holiday.date);
    setHolidayNameInput(holiday.name);
    setHolidayEditTarget({ id: holiday.id });
  };

  const cancelHolidayEdit = () => {
    setHolidayDateInput("");
    setHolidayNameInput("");
    setHolidayEditTarget(null);
  };

  return (
    <>
      <main
        className="calendar-viewport flex-1 max-w-[1400px] mx-auto w-full px-6 py-6"
        style={{ touchAction: "pan-x pan-y pinch-zoom" }}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors"
              aria-label="이전 달"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <select
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-bold py-2 pl-3 pr-10 focus:ring-[#DB5461] focus:border-[#DB5461] cursor-pointer"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-bold py-2 pl-3 pr-10 focus:ring-[#DB5461] focus:border-[#DB5461] cursor-pointer"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {monthNames.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={goNext}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors"
              aria-label="다음 달"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 tracking-tight">
              {year}년 {month}월
            </h2>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
              <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-700 dark:text-zinc-100">공휴일 표시</h3>
                    <p className="text-[11px] text-slate-400 mt-1">기본 2026 공휴일 + 수동 입력 공휴일을 날짜 옆에 보여줍니다.</p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 dark:bg-amber-900/30 dark:text-amber-200">
                      기본 {holidayEntriesData.filter((item) => item.source === "default").length}건
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-1">
                      사용자 {holidayEntriesData.filter((item) => item.source === "custom").length}건
                    </span>
                  </div>
                </div>

                {currentMonthHolidays.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                    <span className="shrink-0">이번 달 공휴일</span>
                    {currentMonthHolidays.map((holiday) => (
                      <span
                        key={`${holiday.iso}-${holiday.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-amber-800 ring-1 ring-amber-300 dark:bg-zinc-950 dark:text-amber-200 dark:ring-amber-800/40"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {holiday.name}
                        <span className="text-[10px] font-bold opacity-70">{holiday.date.slice(5)}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3">
                  <input
                    type="date"
                    value={holidayDateInput}
                    onChange={(e) => setHolidayDateInput(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#DB5461]/30"
                  />
                  <input
                    type="text"
                    value={holidayNameInput}
                    onChange={(e) => setHolidayNameInput(e.target.value)}
                    placeholder="공휴일명 입력"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#DB5461]/30"
                  />
                  <button
                    type="button"
                    onClick={addHoliday}
                    className="rounded-lg bg-[#DB5461] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#c44350] transition-colors"
                  >
                    {holidayEditTarget ? "공휴일 수정" : "공휴일 추가"}
                  </button>
                </div>

                {holidayEditTarget && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                    <span>수동 공휴일 수정 중입니다. 수정 후 버튼을 누르세요.</span>
                    <button
                      type="button"
                      onClick={cancelHolidayEdit}
                      className="font-bold underline decoration-amber-400/70 underline-offset-2"
                    >
                      취소
                    </button>
                  </div>
                )}

                {holidayEntriesData.filter((item) => item.source === "custom").length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {holidayEntriesData
                      .filter((item) => item.source === "custom")
                      .map((holiday) => (
                      <div
                        key={`${holiday.date}-${holiday.name}`}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100"
                      >
                        <button
                          type="button"
                          onClick={() => startEditHoliday(holiday)}
                          className="inline-flex items-center gap-2"
                          title="클릭하면 수정합니다"
                        >
                          <span>{holiday.date}</span>
                          <span className="text-amber-400">·</span>
                          <span>{holiday.name}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20">
              {WEEKDAYS.map((label, i) => (
                <div
                  key={label}
                  className={`py-3 text-center text-xs font-black uppercase tracking-widest bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500 dark:text-zinc-400"
                    }`}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="calendar-grid bg-zinc-100/50 dark:bg-zinc-800/20">
              {cells.map((cell) => {
                const list = reservationsByDate[cell.iso] || [];
                const cancelledCount = list.filter((r) => r.payment_status === "cancelled").length;
                const hasCancelled = cancelledCount > 0;
                const isOtherMonth = !cell.isCurrentMonth;
                const holidays = holidayEntries.get(cell.iso) || [];
                const hasHoliday = holidays.length > 0;
                return (
                  <div
                    key={cell.iso + cell.day}
                    data-cell-iso={cell.iso}
                    role="button"
                    tabIndex={0}
                    onClick={() => !isOtherMonth && openModal(cell.iso)}
                    onKeyDown={(e) => {
                      if (!isOtherMonth && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        openModal(cell.iso);
                      }
                    }}
                    className={`calendar-cell ${focusedIsoDate === cell.iso ? "calendar-cell-focused" : ""} ${isOtherMonth ? "bg-white dark:bg-zinc-900 opacity-40" : "cursor-pointer"} ${hasHoliday && !isOtherMonth ? "ring-2 ring-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:ring-amber-700/60" : ""} ${cell.isToday
                      ? "bg-[#DB5461]/5 dark:bg-[#DB5461]/10 border-2 border-[#DB5461]/50"
                      : ([0, 5, 6].includes(cell.date.getDay())
                        ? "bg-[#DB5461]/10"
                        : "bg-white dark:bg-zinc-900")
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className={`text-sm font-bold ${cell.isToday ? "font-black text-[#DB5461]" : ""
                            } ${isOtherMonth
                              ? "text-slate-400"
                              : (cell.date.getDay() === 0
                                ? "text-red-600"
                                : cell.date.getDay() === 6
                                  ? "text-blue-600"
                                  : "text-slate-700 dark:text-zinc-300")
                            }`}
                        >
                          {cell.day}
                        </span>
                        {hasHoliday && (
                          <span className="inline-flex items-center rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[9px] font-black text-amber-950 shadow-sm ring-1 ring-amber-400 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-700/60">
                            {holidays[0].name}
                            {holidays.length > 1 && (
                              <span className="ml-1 text-[8px] opacity-80">+{holidays.length - 1}</span>
                            )}
                          </span>
                        )}
                        {hasCancelled && (
                          <span className="inline-flex items-center rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[9px] font-bold dark:bg-amber-900/30 dark:text-amber-300">
                            예약취소{cancelledCount}건
                          </span>
                        )}
                      </div>
                      {cell.isToday && (
                        <span className="bg-[#DB5461] text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {FIXED_SLOTS.map((slot) => {
                        const cellReservations = list.filter((r) => r.category === slot.label && r.payment_status !== "cancelled");
                        const isCampnic = slot.label.includes("캠프닉");
                        const count = cellReservations.length;

                        let reservation = cellReservations[0];

                        // 개별 호실 표시 로직 (이미 예약된 호실 컬러를 유지하기 위함)
                        if (!reservation && (slot.label === "201호" || slot.label === "202호")) {
                          reservation = list.find((r) => r.category === "201호+202호" && r.payment_status !== "cancelled");
                        }

                        const isCompleted = isCampnic ? count >= 6 : !!reservation;
                        let btnClass = isCompleted ? "res-btn-primary" : "res-btn-secondary";
                        if (isCampnic) {
                          if (count >= 6) {
                            btnClass = "res-btn-progress"; // 마감도 캠프닉 블루계열
                          } else if (count > 0) {
                            btnClass = "res-btn-progress"; // 예약 있음 캠프닉 블루계열
                          }
                        }

                        return (
                          <button
                            key={slot.label}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(cell.iso, slot.label, reservation);
                            }}
                            className={`${btnClass} w-full flex items-center px-1.5 py-0.5 min-h-[20px] overflow-hidden gap-1`}
                            title={isCompleted ? (isCampnic ? "예약 마감" : "예약 완료") : undefined}
                          >
                            <span className="truncate shrink-0 text-[10px] sm:text-[11px] font-black text-left">{slot.label}</span>

                            {isCampnic ? (
                              <span className={`text-[9px] ml-auto shrink-0 tabular-nums ${count >= 6 || count > 0 ? "text-white/90" : "text-slate-400"}`}>
                                ({count}/6)
                              </span>
                            ) : (
                              reservation && (
                                <div className="flex items-center gap-1 text-[9px] opacity-90 truncate flex-1 justify-end min-w-0">
                                  <span className="truncate font-medium">
                                    {reservation.guest_name}({reservation.people_count})
                                  </span>
                                  <SourceIcon source={reservation.source} />
                                </div>
                              )
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <section className="mt-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-700 dark:text-zinc-100">
                {year}년 월별 매출 현황
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                기준: {salesDateType === "deposit" ? "입금일 기준" : "방문일 기준"}
              </p>
            </div>
            <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setSalesDateType("visit")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  salesDateType === "visit"
                    ? "bg-white dark:bg-zinc-700 text-[#DB5461] shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
                }`}
              >
                방문일 기준
              </button>
              <button
                type="button"
                onClick={() => setSalesDateType("deposit")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  salesDateType === "deposit"
                    ? "bg-white dark:bg-zinc-700 text-[#DB5461] shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
                }`}
              >
                입금일 기준
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {salesDateType === "deposit" ? "총 입금액" : "총 매출"}
                </div>
                <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">
                  {salesLoading ? "—" : fmt(salesYearly?.total ?? 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">원</div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4">
                <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">
                  {salesDateType === "deposit" ? "팬션 입금" : "팬션 매출"}
                </div>
                <div className="text-2xl font-black text-rose-500">
                  {salesLoading ? "—" : fmt(salesYearly?.pension ?? 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">원</div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
                  {salesDateType === "deposit" ? "캠프닉 입금" : "캠프닉 매출"}
                </div>
                <div className="text-2xl font-black text-indigo-500">
                  {salesLoading ? "—" : fmt(salesYearly?.campnic ?? 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">원</div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  {salesDateType === "deposit" ? "총 계약건수" : "총 예약건수"}
                </div>
                <div className="text-2xl font-black text-emerald-500">
                  {salesLoading ? "—" : fmt(salesYearly?.count ?? 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">건</div>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
              {salesLoading ? (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">매출 데이터 로딩 중...</div>
              ) : (
                <div className="flex items-end gap-2 h-64">
                  {MONTH_LABELS.map((label, i) => {
                    const m = salesMonths.find((x) => x.month === i + 1);
                    const pension = m?.pension ?? 0;
                    const campnic = m?.campnic ?? 0;
                    const total = m?.total ?? 0;
                    const barH = total === 0 ? 0 : Math.max(4, Math.round((total / salesMaxTotal) * 200));
                    const pensionH = total === 0 ? 0 : Math.round((pension / total) * barH);
                    const campnicH = barH - pensionH;

                    return (
                      <div key={label} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-center whitespace-nowrap">
                          {total > 0 ? `${fmt(Math.round(total / 10000))}만` : ""}
                        </div>
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
                        <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">{label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
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
          </div>
        </section>

        <footer className="mt-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-4 px-6">
          <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#DB5461]" />
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                  예약확정 (전체강조)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-zinc-200 dark:bg-zinc-700" />
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                  가예약/상담
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              © 2024 StayNamcheon Reservation System. All rights reserved.
            </div>
          </div>
        </footer>

        <button
          type="button"
          onClick={() => openModal()}
          className="fixed bottom-8 right-8 w-14 h-14 bg-[#DB5461] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 hover:bg-[#c44350]"
          aria-label="예약 접수"
        >
          <AddIcon className="w-7 h-7" />
        </button>
      </main>

      <ReservationModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalSelectedReservation(undefined);
          setModalDayReservations([]);
        }}
        defaultDate={modalDefaultDate}
        defaultCategory={modalDefaultCategory}
        initialData={modalSelectedReservation}
        allReservations={modalDayReservations}
        onSaveSuccess={handleSaveSuccess}
      />
    </>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading calendar...</div>}>
      <CalendarContent />
    </Suspense>
  );
}
