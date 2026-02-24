"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ReservationModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDate?: string; // YYYY-MM-DD
  defaultCategory?: string;
  initialData?: any;
  allReservations?: any[];
  onSaveSuccess?: (saved?: { use_date?: string }) => void;
};

const SOURCE_OPTIONS = [
  { value: "phone", label: "전화" },
  { value: "naver", label: "네이버" },
  { value: "nol", label: "놀" },
  { value: "here", label: "여기" },
  { value: "other", label: "기타" },
];

const PENSION_ROOMS = ["201호", "202호", "101호"];
const CAMPNIC_ROOMS = ["캠프닉1부", "캠프닉2부"];

export function ReservationModal({
  open,
  onClose,
  defaultDate,
  defaultCategory,
  initialData,
  allReservations = [],
  onSaveSuccess,
}: ReservationModalProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const findRes = (category: string) =>
    allReservations.find((r) => r.category === category && r.payment_status !== "cancelled");

  const cancelledReservations = allReservations.filter((r) => r.payment_status === "cancelled" && r.type !== "campnic");

  // Helper to populate form from data
  const fillForm = (data: any, fallbackCategory?: string) => {
    const nextType = data?.type || (fallbackCategory?.includes("캠프닉") ? "campnic" : "pension");
    if (data) {
      const useDate = data.use_date?.slice(0, 10) || today;
      const depositDate = data.deposit_date?.slice(0, 10) || today;
      let phone = data.phone || "";
      if (phone.length === 11) {
        phone = phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
      } else if (phone.length === 10) {
        phone = phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
      }

      setForm({
        id: data.id || "",
        type: nextType,
        category: data.category || PENSION_ROOMS[0],
        use_date: useDate,
        nights: data.nights || 1,
        quantity: data.quantity || 1,
        guest_name: data.guest_name || "",
        phone: phone,
        people_count: data.people_count || 2,
        user_type: data.user_type || "일반",
        total_amount: data.total_amount ? data.total_amount.toLocaleString() : "",
        extra_amount: data.extra_amount ? data.extra_amount.toLocaleString() : "",
        payment_status: data.payment_status || "confirmed",
        deposit_date: depositDate,
        source: data.source || "phone",
        memo: data.memo || "",
      });
    } else {
      setForm((f) => ({
        ...f,
        id: "",
        type: nextType,
        category: fallbackCategory || f.category,
        guest_name: "",
        phone: "",
        memo: "",
        total_amount: "",
        extra_amount: "",
      }));
    }
  };

  // KST(또는 로컬 시간대) 기준으로 오늘 날짜의 YYYY-MM-DD 구하기
  const getLocalIsoDate = (d = new Date()) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
    return localISOTime;
  };
  const today = getLocalIsoDate();

  const [form, setForm] = useState({
    id: "",
    type: "pension",
    category: PENSION_ROOMS[0],
    use_date: defaultDate ?? today,
    nights: 1,
    quantity: 1,
    guest_name: "",
    phone: "",
    people_count: 2,
    user_type: "일반",
    total_amount: "",
    extra_amount: "",
    payment_status: "confirmed",
    deposit_date: today,
    source: "phone",
    memo: "",
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        // 캠프닉이면 항상 신규추가 탭이 먼저 뜨도록, 펜션이면 해당 카테고리
        if (initialData.type === 'campnic') {
          setActiveTabId("new");
          fillForm(null, initialData.category);
        } else {
          setActiveTabId(initialData.category);
          fillForm(initialData);
        }
      } else {
        const nextType = defaultCategory?.includes("캠프닉") ? "campnic" : "pension";
        if (nextType === 'pension') {
          const targetCat = defaultCategory || PENSION_ROOMS[0];
          setActiveTabId(targetCat);
          const res = findRes(targetCat);
          fillForm(res, targetCat);
        } else {
          setActiveTabId("new");
          fillForm(null, defaultCategory);
        }

        setForm((f) => ({
          ...f,
          use_date: defaultDate ?? f.use_date,
          deposit_date: today, // 입금일은 항상 예약 접수한 오늘 날짜
        }));
      }
      setError("");
    }
  }, [open, defaultDate, defaultCategory, initialData, today, allReservations]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 숫자만 추출
    let val = e.target.value.replace(/\D/g, "");
    // 자동 하이픈 추가
    if (val.length > 3 && val.length <= 7) {
      val = val.replace(/(\d{3})(\d{1,4})/, "$1-$2");
    } else if (val.length > 7) {
      val = val.replace(/(\d{3})(\d{3,4})(\d{1,4})/, "$1-$2-$3");
    }
    setForm((f) => ({ ...f, phone: val }));
  };

  const handleAmountChange = (field: "total_amount" | "extra_amount", value: string) => {
    // 숫자만 추출 후 천단위 콤마
    const num = value.replace(/,/g, "").replace(/\D/g, "");
    if (!num) {
      setForm((f) => ({ ...f, [field]: "" }));
      return;
    }
    const formatted = parseInt(num, 10).toLocaleString();
    setForm((f) => ({ ...f, [field]: formatted }));
  };

  const handleTypeChange = (val: string) => {
    setForm((f) => ({
      ...f,
      type: val,
      category: val === "campnic" ? CAMPNIC_ROOMS[0] : PENSION_ROOMS[0],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | undefined;
    const mode = submitter?.dataset?.mode || "register";

    const totalAmount = form.total_amount ? parseInt(form.total_amount.replace(/,/g, ""), 10) : 0;
    const extraAmount = form.extra_amount ? parseInt(form.extra_amount.replace(/,/g, ""), 10) : 0;
    const finalAmount = totalAmount + extraAmount;

    if (mode === "register") {
      const confirmMessage =
        `아래 내용으로 저장할까요?\n\n` +
        `이용일: ${form.use_date}\n` +
        `호실: ${form.category}\n` +
        `인원: ${form.people_count}명\n` +
        `금액: ${finalAmount.toLocaleString()}원`;

      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setError("");
    setSubmitting(true);
    try {
      const phoneToSave = form.phone.replace(/-/g, "");
      const payload: any = {
        ...form,
        total_amount: totalAmount,
        extra_amount: extraAmount,
        phone: phoneToSave,
        cancel_date: form.payment_status === "cancelled" ? form.deposit_date : form.deposit_date,
      };

      // '예약추가' 모드일 경우에는 신규 등록(POST)으로 처리하고 ID를 제외함
      if (mode === "add") {
        delete payload.id;
      }

      const res = await fetch("/api/admin/reservations", {
        method: (form.id && mode !== "add") ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "저장 실패");
        return;
      }

      if (onSaveSuccess) {
        onSaveSuccess({ use_date: data?.use_date || payload.use_date });
      }
      router.refresh();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const isCampnic = form.type === "campnic";
  const accentHex = isCampnic ? "#4F46E5" : "#DB5461";
  const accentBorder = isCampnic ? "focus:ring-[#4F46E5] focus:border-[#4F46E5]" : "focus:ring-[#DB5461] focus:border-[#DB5461]";
  const accentBg = isCampnic ? "bg-[#4F46E5] hover:bg-[#4338ca]" : "bg-[#DB5461] hover:bg-[#c44350]";
  const accentTabBorder = isCampnic ? "border-[#4F46E5] text-[#4F46E5]" : "border-[#DB5461] text-[#DB5461]";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-xl max-h-screen flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100 tracking-tight">
            예약 접수
          </h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 outline-none">
            ✕
          </button>
        </div>

        {/* Tab System */}
        <div className="flex bg-slate-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-hide">
          {form.type === "pension" ? (
            <>
              {PENSION_ROOMS.map((room) => {
                const res = findRes(room);
                const isActive = activeTabId === room;
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() => {
                      setActiveTabId(room);
                      fillForm(res, room);
                    }}
                    className={`px-5 py-3 text-[13px] font-bold transition-all border-b-2 flex flex-col items-center gap-0.5 min-w-[80px]
                    ${isActive
                        ? `${accentTabBorder} bg-white dark:bg-zinc-900`
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                  >
                    <span>{room}</span>
                    {res && <span className="text-[10px] font-medium text-slate-400">({res.guest_name})</span>}
                  </button>
                );
              })}
              {cancelledReservations.map((res) => {
                const tabId = `cancel-${String(res.id)}`;
                const isActive = activeTabId === tabId;
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => {
                      setActiveTabId(tabId);
                      fillForm(res, res.category);
                    }}
                    className={`px-4 py-3 text-[12px] font-bold transition-all border-b-2 min-w-[90px]
                    ${isActive
                        ? "border-amber-500 text-amber-700 bg-white dark:bg-zinc-900"
                        : "border-transparent text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-zinc-800"
                      }`}
                  >
                    {res.guest_name} cancel
                  </button>
                );
              })}
            </>
          ) : (
            <>
              {(allReservations.filter(r => r.category === form.category && r.payment_status !== 'cancelled').length < 6) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTabId("new");
                    fillForm(null, form.category);
                  }}
                  className={`px-5 py-3 text-[13px] font-bold transition-all border-b-2
                    ${activeTabId === "new" || !activeTabId || (typeof activeTabId === 'string' && !allReservations.find(r => r.id === activeTabId))
                      ? `${accentTabBorder} bg-white dark:bg-zinc-900`
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                >
                  [+] 신규추가
                </button>
              )}
              {allReservations
                .filter((r) => r.category === form.category && r.payment_status !== "cancelled")
                .map((res) => {
                  const isActive = activeTabId === res.id;
                  return (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => {
                        setActiveTabId(res.id);
                        fillForm(res);
                      }}
                      className={`px-5 py-3 text-[13px] font-bold transition-all border-b-2 min-w-[80px]
                        ${isActive
                          ? `${accentTabBorder} bg-white dark:bg-zinc-900`
                          : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        }`}
                    >
                      {res.guest_name}
                    </button>
                  );
                })}
            </>
          )}

        </div>

        <div className="overflow-y-auto p-6 scrollbar-hide">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <p className="text-sm font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Top Row: Type, Category, UserType */}
            <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50">
              <div className="flex items-center gap-2 flex-1">
                <label className="w-[36px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                  유형
                </label>
                <select
                  className={`flex-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-1.5 px-2 focus:outline-none focus:ring-1 ${accentBorder}`}
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  <option value="pension">펜션</option>
                  <option value="campnic">캠프닉</option>
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <label className="w-[36px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                  호실
                </label>
                <select
                  required
                  className={`flex-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-1.5 px-2 focus:outline-none focus:ring-1 ${accentBorder}`}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {(form.type === "campnic" ? CAMPNIC_ROOMS : PENSION_ROOMS).map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <label className="w-[36px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                  구분
                </label>
                <select
                  className={`flex-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-1.5 px-2 focus:outline-none focus:ring-1 ${accentBorder}`}
                  value={form.user_type}
                  onChange={(e) => setForm((f) => ({ ...f, user_type: e.target.value }))}
                >
                  <option value="일반">일반</option>
                  <option value="야수교">야수교</option>
                </select>
              </div>
            </div>

            {/* Main Content Layout (Left & Right) */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-1">

              {/* Left Column */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    이용일
                  </label>
                  <input
                    type="date"
                    required
                    className={`flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder}`}
                    value={form.use_date}
                    onChange={(e) => setForm((f) => ({ ...f, use_date: e.target.value }))}
                  />
                </div>


                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    예약자
                  </label>
                  <input
                    type="text"
                    required
                    className={`flex-1 max-w-[150px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder}`}
                    value={form.guest_name}
                    onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))}
                    placeholder="이름"
                    maxLength={13}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    총 금액
                  </label>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      className={`w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder} text-right`}
                      value={form.total_amount}
                      onChange={(e) => handleAmountChange("total_amount", e.target.value)}
                    />
                    <span className="text-[13px] text-slate-500 font-medium whitespace-nowrap">원</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    입금일
                  </label>
                  <input
                    type="date"
                    required
                    className={`flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder}`}
                    value={form.deposit_date}
                    onChange={(e) => setForm((f) => ({ ...f, deposit_date: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    상태
                  </label>
                  <select
                    className={`flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder}`}
                    value={form.payment_status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, payment_status: e.target.value }))
                    }
                  >
                    <option value="confirmed">확정</option>
                    <option value="cancelled">취소</option>
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    {isCampnic ? "팀원" : "인원"}
                  </label>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      className={`w-[70px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder}`}
                      value={form.people_count === 0 ? "" : form.people_count}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, people_count: Number(e.target.value) || 0 }))
                      }
                    />
                    <span className="text-[13px] text-slate-500 font-medium">명</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    연락처
                  </label>
                  <input
                    type="tel"
                    className={`flex-1  max-w-[150px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder}`}
                    value={form.phone}
                    onChange={handlePhoneChange}
                    placeholder="010-0000-0000"
                    maxLength={13}
                  />
                </div>



                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    추가금
                  </label>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      className={`w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder} text-right`}
                      value={form.extra_amount}
                      onChange={(e) => handleAmountChange("extra_amount", e.target.value)}
                    />
                    <span className="text-[13px] text-slate-500 font-medium whitespace-nowrap">원</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300">
                    접수 경로
                  </label>
                  <select
                    className={`flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder}`}
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bottom Memo Row */}
            <div className="flex items-start gap-3 px-1 mt-1">
              <label className="w-[50px] whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-300 mt-2.5">
                메모
              </label>
              <textarea
                rows={4}
                className={`flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] py-2 px-3 focus:outline-none focus:ring-1 ${accentBorder} resize-none`}
                value={form.memo}
                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                placeholder="메모 (선택)"
              />
            </div>

            <div className="flex items-center gap-3 pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="submit"
                data-mode="register"
                disabled={submitting}
                className={`flex-[2] py-3 rounded-lg ${accentBg} text-white font-bold text-[15px] disabled:opacity-50 transition-colors shadow-sm tracking-wide`}
              >
                {submitting ? "저장 중…" : (form.id ? "예약수정" : "예약등록")}
              </button>
              <button
                type="submit"
                data-mode="add"
                disabled={submitting}
                className="flex-[1] py-3 rounded-lg bg-emerald-500 text-white font-bold text-[15px] hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm tracking-wide"
              >
                예약추가
              </button>
            </div>
          </form>
        </div>
      </div >
    </div >
  );
}
