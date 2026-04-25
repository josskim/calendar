"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, PencilLine, Plus, Trash2 } from "lucide-react";

type HolidayEntry = {
  id: number;
  date: string;
  name: string;
  source: "default" | "custom";
};

function HolidayManagerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialYear = searchParams.get("year") || "all";

  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(initialYear);
  const [dateInput, setDateInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/holidays");
      if (!res.ok) return;
      const data = await res.json();
      setHolidays(
        Array.isArray(data)
          ? data
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  useEffect(() => {
    const nextYear = searchParams.get("year") || "all";
    setYearFilter(nextYear);
  }, [searchParams]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const holiday of holidays) {
      const year = Number(holiday.date.slice(0, 4));
      if (!Number.isNaN(year)) set.add(year);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [holidays]);

  const filtered = useMemo(() => {
    if (yearFilter === "all") return holidays;
    return holidays.filter((holiday) => holiday.date.startsWith(`${yearFilter}-`));
  }, [holidays, yearFilter]);

  const stats = useMemo(() => {
    return {
      total: holidays.length,
      defaults: holidays.filter((holiday) => holiday.source === "default").length,
      custom: holidays.filter((holiday) => holiday.source === "custom").length,
      visible: filtered.length,
    };
  }, [filtered.length, holidays]);

  const syncFilter = (nextYear: string) => {
    setYearFilter(nextYear);
    if (nextYear === "all") router.replace("/admin/holidays");
    else router.replace(`/admin/holidays?year=${nextYear}`);
  };

  const resetForm = () => {
    setDateInput("");
    setNameInput("");
    setEditingId(null);
  };

  const saveHoliday = async () => {
    if (!dateInput || !nameInput.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/admin/holidays/${editingId}` : "/api/admin/holidays", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateInput, name: nameInput.trim() }),
      });

      if (!res.ok) return;
      await loadHolidays();
      resetForm();
    } catch (error) {
      console.error("Failed to save holiday", error);
    } finally {
      setSaving(false);
    }
  };

  const editHoliday = (holiday: HolidayEntry) => {
    setDateInput(holiday.date);
    setNameInput(holiday.name);
    setEditingId(holiday.id);
  };

  const deleteHoliday = async (holiday: HolidayEntry) => {
    const ok = window.confirm(`${holiday.date} ${holiday.name} 공휴일을 삭제할까요?`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/holidays/${holiday.id}`, { method: "DELETE" });
      if (!res.ok) return;
      await loadHolidays();
      if (editingId === holiday.id) resetForm();
    } catch (error) {
      console.error("Failed to delete holiday", error);
    }
  };

  return (
    <main className="calendar-viewport p-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col gap-6">
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#DB5461]/10 px-3 py-1 text-xs font-bold text-[#DB5461]">
                <CalendarDays size={14} />
                공휴일 관리
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100">
                공휴일을 연도별로 관리하고 바로 반영합니다
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                기본 공휴일과 수동 공휴일을 한 화면에서 추가, 수정, 삭제할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:flex md:items-center">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">전체</div>
                <div className="mt-1 text-xl font-black text-slate-900 dark:text-zinc-100">{stats.total}건</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">기본</div>
                <div className="mt-1 text-xl font-black text-amber-700 dark:text-amber-300">{stats.defaults}건</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">수동</div>
                <div className="mt-1 text-xl font-black text-slate-800 dark:text-zinc-100">{stats.custom}건</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">표시 중</div>
                <div className="mt-1 text-xl font-black text-[#DB5461]">{stats.visible}건</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-slate-500 dark:text-zinc-400 mr-2">연도 보기</span>
              <button
                type="button"
                onClick={() => syncFilter("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
                  yearFilter === "all"
                    ? "bg-[#DB5461] text-white shadow-sm"
                    : "bg-zinc-100 text-slate-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                전체
              </button>
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => syncFilter(String(year))}
                  className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
                    yearFilter === String(year)
                      ? "bg-[#DB5461] text-white shadow-sm"
                      : "bg-zinc-100 text-slate-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {year}년
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[180px_1fr_auto] gap-3 items-end">
              <div>
                <label className="mb-2 block text-xs font-black text-slate-500 dark:text-zinc-400">날짜</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#DB5461]/30"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black text-slate-500 dark:text-zinc-400">공휴일명</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="예: 어린이날, 추석"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#DB5461]/30"
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  onClick={saveHoliday}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#DB5461] px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#c44350] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  {editingId ? "공휴일 수정" : "공휴일 추가"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm font-black text-slate-700 dark:text-zinc-200"
                  >
                    편집 취소
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex flex-col gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100">공휴일 목록</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                기본 공휴일은 amber, 수동 공휴일은 slate 톤으로 구분했습니다. 상단 연도 탭으로 빠르게 필터링할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60">
                <tr className="text-left">
                  <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">날짜</th>
                  <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">공휴일명</th>
                  <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">구분</th>
                  <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-400">
                      공휴일을 불러오는 중입니다...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-400">
                      선택한 연도에 공휴일이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filtered.map((holiday) => (
                    <tr key={holiday.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-zinc-200 whitespace-nowrap">{holiday.date}</td>
                      <td className="px-6 py-4 font-black text-slate-900 dark:text-zinc-100">{holiday.name}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${
                            holiday.source === "default"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                              : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          {holiday.source === "default" ? "기본" : "수동"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editHoliday(holiday)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs font-black text-slate-700 dark:text-zinc-200 hover:border-[#DB5461]/40 hover:text-[#DB5461]"
                          >
                            <PencilLine size={14} />
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteHoliday(holiday)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
                          >
                            <Trash2 size={14} />
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function HolidaysAdminPage() {
  return (
    <Suspense
      fallback={
        <main className="calendar-viewport p-6 max-w-[1400px] mx-auto w-full">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-slate-500 dark:text-zinc-400">
            공휴일 관리 화면을 불러오는 중입니다...
          </div>
        </main>
      }
    >
      <HolidayManagerContent />
    </Suspense>
  );
}
