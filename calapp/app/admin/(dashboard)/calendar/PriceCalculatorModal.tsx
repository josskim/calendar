"use client";

import { useEffect, useMemo, useState } from "react";
import { Beef, CalendarDays, Check, Minus, Plus, Users, X } from "lucide-react";
import {
  BARBECUE_PRICE,
  EXTRA_GUEST_PRICE,
  ROOM_PRICE_OPTIONS,
  calculateReservationPrice,
  getPriceSeason,
  type RoomPriceId,
} from "@/lib/reservation-price-calculator";

type Props = {
  initialDate: string;
  holidayNames: string[];
  holidayDates: ReadonlySet<string>;
  onClose: () => void;
};

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export function PriceCalculatorModal({
  initialDate,
  holidayNames,
  holidayDates,
  onClose,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedRooms, setSelectedRooms] = useState<RoomPriceId[]>([]);
  const [guests, setGuests] = useState(2);
  const [barbecue, setBarbecue] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const selectedHolidayNames = selectedDate === initialDate
    ? holidayNames
    : [];
  const isHoliday = holidayDates.has(selectedDate);
  const season = getPriceSeason(selectedDate, isHoliday);
  const calculation = useMemo(
    () => calculateReservationPrice({ selectedRooms, guests, season, barbecue }),
    [barbecue, guests, season, selectedRooms]
  );

  const seasonLabel = season === "peak" ? "성수기" : season === "weekend" ? "주말 요금" : "평일 요금";
  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${selectedDate}T12:00:00`));

  const toggleRoom = (roomId: RoomPriceId) => {
    setSelectedRooms((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : ROOM_PRICE_OPTIONS.filter((room) => current.includes(room.id) || room.id === roomId).map((room) => room.id)
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-calculator-title"
        className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl dark:bg-zinc-950 sm:max-h-[90vh] sm:rounded-[28px]"
      >
        <div className="bg-gradient-to-br from-[#DB5461] to-[#b83f54] px-5 pb-5 pt-4 text-white sm:px-7 sm:pt-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">Stay Namcheon</p>
              <h2 id="price-calculator-title" className="text-xl font-black tracking-tight sm:text-2xl">예약금액 계산기</h2>
              <p className="mt-1 text-xs font-medium text-white/75">문의받은 날짜의 정상가를 빠르게 확인합니다.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
              aria-label="계산기 닫기"
            >
              <X size={21} />
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white/12 p-3 ring-1 ring-white/20">
            <CalendarDays className="shrink-0" size={22} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-white/65">숙박일</p>
              <p className="truncate text-sm font-black">{dateLabel}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#b83f54]">{seasonLabel}</span>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 py-5 sm:px-7">
          <label className="mb-5 block">
            <span className="mb-2 block text-xs font-black text-slate-500 dark:text-zinc-400">날짜 변경</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-slate-800 outline-none focus:border-[#DB5461] focus:ring-2 focus:ring-[#DB5461]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {isHoliday && (
              <span className="mt-2 block text-[11px] font-bold text-amber-700 dark:text-amber-300">
                공휴일 표시 날짜 · {season === "peak" ? "성수기 요금 우선 적용" : "주말 요금 적용"}
                {selectedHolidayNames.length ? ` (${selectedHolidayNames.join(", ")})` : ""}
              </span>
            )}
          </label>

          <div className="mb-6">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100">호실 선택</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">여러 호실을 함께 선택할 수 있어요.</p>
              </div>
              <span className="text-xs font-black text-[#DB5461]">{selectedRooms.length}개 선택</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {ROOM_PRICE_OPTIONS.map((room) => {
                const selected = selectedRooms.includes(room.id);
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => toggleRoom(room.id)}
                    className={`relative min-h-[92px] rounded-2xl border p-3 text-left transition active:scale-[0.98] ${selected
                      ? "border-[#DB5461] bg-rose-50 text-[#a83348] ring-2 ring-[#DB5461]/10 dark:bg-rose-950/30"
                      : "border-zinc-200 bg-white text-slate-700 hover:border-rose-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    <span className="block text-sm font-black">{room.label}</span>
                    <span className="mt-1 block text-[10px] font-medium opacity-65">{room.description}</span>
                    <span className="mt-2 block text-xs font-black">{won(room[season])}</span>
                    {selected && (
                      <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#DB5461] text-white">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {calculation.hasCombinedPension && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                201호+202호 독채 기준인원 10명으로 계산됩니다.
              </p>
            )}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700 dark:text-zinc-200">
                <Users size={17} className="text-[#DB5461]" /> 총 인원
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white p-1.5 shadow-sm dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setGuests((value) => Math.max(1, value - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="인원 줄이기"
                ><Minus size={18} /></button>
                <label className="flex items-baseline gap-1">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={guests}
                    onChange={(event) => setGuests(Math.max(1, Number(event.target.value) || 1))}
                    className="w-12 bg-transparent text-center text-xl font-black text-slate-900 outline-none dark:text-white"
                    aria-label="총 인원"
                  />
                  <span className="text-xs font-bold text-slate-400">명</span>
                </label>
                <button
                  type="button"
                  onClick={() => setGuests((value) => Math.min(99, value + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="인원 늘리기"
                ><Plus size={18} /></button>
              </div>
              {selectedRooms.length > 0 && (
                <p className={`mt-2 text-[10px] font-bold ${guests > calculation.maxGuests ? "text-red-500" : "text-slate-400"}`}>
                  기준 {calculation.baseGuests}명 · 최대 {calculation.maxGuests}명
                  {guests > calculation.maxGuests ? " (최대인원 초과)" : ""}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setBarbecue((value) => !value)}
              className={`rounded-2xl border p-4 text-left transition active:scale-[0.98] ${barbecue
                ? "border-orange-400 bg-orange-50 ring-2 ring-orange-200/60 dark:bg-orange-950/25"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-zinc-200">
                  <Beef size={18} className="text-orange-500" /> 바베큐
                </span>
                <span className={`relative h-7 w-12 rounded-full transition ${barbecue ? "bg-orange-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${barbecue ? "left-6" : "left-1"}`} />
                </span>
              </span>
              <span className="mt-3 block text-lg font-black text-slate-900 dark:text-white">+ {won(BARBECUE_PRICE)}</span>
              <span className="mt-1 block text-[10px] font-medium text-slate-400">그릴·숯 대여</span>
            </button>
          </div>

          <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-900/10 dark:bg-black sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-bold text-white/60">예상 정상가</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-white/80">{seasonLabel}</span>
            </div>
            <div className="space-y-2 border-b border-white/10 pb-4 text-xs">
              <div className="flex justify-between"><span className="text-white/55">객실 요금</span><b>{won(calculation.roomPrice)}</b></div>
              <div className="flex justify-between"><span className="text-white/55">추가 인원 {calculation.extraGuests}명 × {won(EXTRA_GUEST_PRICE)}</span><b>+ {won(calculation.extraGuestPrice)}</b></div>
              <div className="flex justify-between"><span className="text-white/55">바베큐</span><b>+ {won(calculation.barbecuePrice)}</b></div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <span className="text-sm font-black">총 금액</span>
              <strong className="text-3xl font-black tracking-tight text-rose-300 sm:text-4xl">
                {won(calculation.total)}
              </strong>
            </div>
            {selectedRooms.length === 0 && (
              <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-center text-[11px] font-bold text-white/65">호실을 선택하면 금액이 계산됩니다.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
