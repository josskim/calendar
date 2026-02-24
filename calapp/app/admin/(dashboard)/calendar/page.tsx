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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
          Ya
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
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
            {WEEKDAYS.map((label, i) => (
              <div
                key={label}
                className={`py-3 text-center text-xs font-black uppercase tracking-widest bg-zinc-50/50 dark:bg-zinc-800/30 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500 dark:text-zinc-400"
                  }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="calendar-grid bg-zinc-100/50 dark:bg-zinc-800/20">
            {cells.map((cell) => {
              const list = reservationsByDate[cell.iso] || [];
              const isOtherMonth = !cell.isCurrentMonth;
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
                  className={`calendar-cell ${focusedIsoDate === cell.iso ? "calendar-cell-focused" : ""} ${isOtherMonth ? "bg-white dark:bg-zinc-900 opacity-40" : "cursor-pointer"} ${cell.isToday
                    ? "bg-[#DB5461]/5 dark:bg-[#DB5461]/10 border-2 border-[#DB5461]/50"
                    : ([0, 5, 6].includes(cell.date.getDay())
                      ? "bg-[#DB5461]/10"
                      : "bg-white dark:bg-zinc-900")
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
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
