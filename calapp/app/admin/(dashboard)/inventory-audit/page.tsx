"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, ShieldCheck, X, XCircle } from "lucide-react";

type AuditJob = {
  id: string;
  from: string;
  to: string;
  status: string;
  totalChecks: number;
  completedChecks: number;
  normalCount: number;
  criticalCount: number;
  warningCount: number;
  errorCount: number;
  currentTarget?: string | null;
  lastError?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

type Finding = {
  id: string;
  date: string;
  site: string;
  product: string;
  calendarBlocked: boolean;
  calendarSources: string[];
  calendarReservations: Array<{ id: string; guestName: string; room: string; source: string }>;
  observedState: string | null;
  severity: "critical" | "warning" | "error" | "normal";
  code: string;
  label: string;
  details: Record<string, unknown>;
  error?: string | null;
  policyNote?: string | null;
};

type SiteSummary = {
  site: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  total: number;
  completed: number;
  normal: number;
  critical: number;
  warning: number;
  error: number;
  cancelled: number;
  errorReason?: string | null;
};

const SITE_NAMES: Record<string, string> = {
  naver: "네이버",
  yanolja: "야놀자",
  goodchoice: "여기어때",
  airbnb: "에어비앤비",
};

const AUDIT_SITE_OPTIONS = [
  { value: "naver", label: "네이버" },
  { value: "yanolja", label: "야놀자" },
  { value: "goodchoice", label: "여기어때" },
  { value: "airbnb", label: "에어비앤비" },
] as const;

const STATE_NAMES: Record<string, string> = {
  open: "예약 가능",
  blocked_by_host: "관리자 마감",
  blocked_by_booking: "예약 완료",
  not_on_sale: "예약이 아직 열리지 않음",
  unknown: "확인 실패",
};

function isoLocal(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function defaultRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 5);
  return { from: isoLocal(from), to: isoLocal(to) };
}

function dateTimeText(value?: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold opacity-80">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString()}</p>
    </div>
  );
}

export default function InventoryAuditPage() {
  const defaults = useMemo(defaultRange, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [job, setJob] = useState<AuditJob | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [recentJobs, setRecentJobs] = useState<AuditJob[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>(
    AUDIT_SITE_OPTIONS.map((site) => site.value)
  );
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");

  const loadRecent = useCallback(async () => {
    const response = await fetch("/api/admin/inventory-audits", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setRecentJobs(data.jobs ?? []);
  }, []);

  const loadJob = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/inventory-audits/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setJob(data.job);
    setFindings(data.findings ?? []);
    setSites(data.sites ?? []);
    if (data.sites?.length) {
      const included = new Set<string>(data.sites.map((site: SiteSummary) => site.site));
      setSelectedSites(
        AUDIT_SITE_OPTIONS.map((site) => site.value).filter((site) => included.has(site))
      );
    }
    setFrom(data.job.from);
    setTo(data.job.to);
  }, []);

  const startAudit = useCallback(async (range = { from, to }) => {
    if (!selectedSites.length) {
      setMessage("검증할 사이트를 하나 이상 선택해주세요.");
      return;
    }
    const siteLabels = AUDIT_SITE_OPTIONS
      .filter((site) => selectedSites.includes(site.value))
      .map((site) => site.label)
      .join(", ");
    if (!window.confirm(`${range.from} ~ ${range.to} 기간을 새로 검증할까요?\n검증 사이트: ${siteLabels}\n동일 기간·동일 사이트의 오류 없는 완료 보고서가 있으면 기존 결과를 엽니다.`)) return;
    setStarting(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/inventory-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...range, sites: selectedSites }),
      });
      const data = await response.json();
      if (!response.ok && response.status !== 409) throw new Error(data.error ?? "검증 시작 실패");
      const id = String(data.id);
      window.history.replaceState({}, "", `/admin/inventory-audit?id=${id}`);
      await loadJob(id);
      if (data.reused) setMessage("동일 기간의 검증 완료 보고서를 불러왔습니다. 다시 검증하지 않았습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "검증을 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }, [from, to, loadJob, selectedSites]);

  const cancelAudit = useCallback(async () => {
    if (!job || !window.confirm(`검증 #${job.id}을 중지할까요?\n외부 사이트의 판매 상태는 변경되지 않습니다.`)) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/admin/inventory-audits/${job.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "검증을 중지하지 못했습니다.");
        return;
      }
      setMessage("검증을 중지했습니다. 예약 동기화 워커는 계속 실행됩니다.");
      await loadJob(job.id);
    } finally {
      setCancelling(false);
    }
  }, [job, loadJob]);

  const toggleSite = useCallback((site: string) => {
    setSelectedSites((current) =>
      current.includes(site)
        ? current.filter((item) => item !== site)
        : AUDIT_SITE_OPTIONS.map((item) => item.value).filter(
            (item) => item === site || current.includes(item)
          )
    );
  }, []);

  const allSitesSelected = selectedSites.length === AUDIT_SITE_OPTIONS.length;

  const closeReport = useCallback(() => {
    setJob(null);
    setFindings([]);
    setSites([]);
    window.history.replaceState({}, "", "/admin/inventory-audit");
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      loadJob(id);
      return;
    }
    loadRecent();
  }, [loadJob, loadRecent]);

  useEffect(() => {
    if (!job || !["pending", "processing"].includes(job.status)) return;
    const timer = window.setInterval(() => loadJob(job.id), 3000);
    return () => window.clearInterval(timer);
  }, [job, loadJob]);

  const progress = job?.totalChecks ? Math.round((job.completedChecks / job.totalChecks) * 100) : 0;
  const isRunning = job && ["pending", "processing"].includes(job.status);
  const jobStatusLabel = job?.status === "completed"
    ? "검증 완료"
    : job?.status === "cancelled"
      ? "검증 중지됨"
      : `진행 중 ${progress}%`;

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck size={22} />
              <span className="text-xs font-black uppercase tracking-[0.16em]">Read-only audit</span>
            </div>
            <h1 className="mt-2 text-2xl font-black md:text-3xl">오늘 이후 예약 검증 보고서</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-zinc-400">
              CalApp 펜션 예약과 네이버·야놀자·여기어때·에어비앤비의 판매/예약 상태를 비교합니다.
              이 작업은 상태를 변경하지 않고 보고서만 만듭니다.
            </p>
            <p className="mt-2 max-w-3xl rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold leading-5 text-sky-800">
              네이버 운영 규칙: 토요일은 201호·202호 단독 상품을 닫고, 201호+202호 묶음 상품만 판매합니다.
            </p>
          </div>
          <div className="flex max-w-xl flex-wrap items-end justify-end gap-2">
            <fieldset disabled={Boolean(isRunning)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 disabled:opacity-60">
              <div className="flex items-center justify-between gap-3">
                <legend className="px-1 text-[11px] font-black text-slate-600">검증 사이트</legend>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-black text-emerald-700">
                  <input
                    type="checkbox"
                    checked={allSitesSelected}
                    onChange={(event) => setSelectedSites(
                      event.target.checked ? AUDIT_SITE_OPTIONS.map((site) => site.value) : []
                    )}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  전체 선택
                </label>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AUDIT_SITE_OPTIONS.map((site) => (
                  <label
                    key={site.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                      selectedSites.includes(site.value)
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 bg-white text-slate-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSites.includes(site.value)}
                      onChange={() => toggleSite(site.value)}
                      className="h-4 w-4 accent-emerald-700"
                    />
                    {site.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-[11px] font-bold text-slate-500">시작일
              <input type="date" value={from} disabled={Boolean(isRunning)} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-zinc-200 px-3 py-2 text-sm text-slate-900 disabled:bg-zinc-100" />
            </label>
            <label className="text-[11px] font-bold text-slate-500">종료일
              <input type="date" value={to} disabled={Boolean(isRunning)} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-zinc-200 px-3 py-2 text-sm text-slate-900 disabled:bg-zinc-100" />
            </label>
            <button type="button" disabled={starting || Boolean(isRunning) || selectedSites.length === 0} onClick={() => startAudit()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white disabled:bg-zinc-300">
              {starting ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              새 검증 시작
            </button>
            {isRunning && (
              <button type="button" disabled={cancelling} onClick={cancelAudit} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700 disabled:bg-red-300">
                {cancelling ? <RefreshCw size={16} className="animate-spin" /> : <XCircle size={16} />} 검증 중지
              </button>
            )}
          </div>
        </div>
        {message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{message}</p>}
      </section>

      {job ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-2 backdrop-blur-[1px] md:p-6" role="presentation">
          <div role="dialog" aria-modal="true" aria-label={`검증 #${job.id} 결과`} className="flex max-h-[calc(100vh-1rem)] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-[#f7f7f5] shadow-2xl md:max-h-[calc(100vh-3rem)] md:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:px-6">
              <div>
                <p className="font-black">검증 #{job.id} 결과</p>
                <p className="mt-0.5 text-xs text-slate-500">실행 {dateTimeText(job.createdAt)}{job.completedAt ? ` · 완료 ${dateTimeText(job.completedAt)}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                {isRunning && (
                  <button type="button" disabled={cancelling} onClick={cancelAudit} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-sm font-black text-white hover:bg-red-700 disabled:bg-red-300">
                    {cancelling ? <RefreshCw size={16} className="animate-spin" /> : <XCircle size={16} />}
                    검증 중지
                  </button>
                )}
                <button type="button" onClick={closeReport} aria-label="검증 결과 닫기" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-black text-slate-700 hover:bg-zinc-50">
                  <X size={18} /> 닫기
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-3 pb-6 md:px-6">
          <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">검증 #{job.id} · {job.from} ~ {job.to}</p>
                <p className="mt-1 text-xs text-slate-500">{job.status === "completed" ? "검증 완료" : job.status === "cancelled" ? "사용자가 검증을 중지했습니다." : "워커가 사이트 상태를 확인하고 있습니다."}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${job.status === "completed" ? "bg-emerald-100 text-emerald-700" : job.status === "cancelled" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700"}`}>
                {jobStatusLabel}
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
              <span>{job.completedChecks.toLocaleString()} / {job.totalChecks.toLocaleString()}개 확인</span>
              <span className="truncate">{job.currentTarget ? `현재: ${job.currentTarget}` : "대기 중"}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="정상" value={job.normalCount} tone="border-emerald-200 bg-emerald-50 text-emerald-800" icon={<CheckCircle2 size={18} />} />
              <SummaryCard label="중요 확인" value={job.criticalCount} tone="border-red-200 bg-red-50 text-red-800" icon={<ShieldAlert size={18} />} />
              <SummaryCard label="마감 확인" value={job.warningCount} tone="border-amber-200 bg-amber-50 text-amber-800" icon={<AlertTriangle size={18} />} />
              <SummaryCard label="조회 오류" value={job.errorCount} tone="border-slate-200 bg-slate-50 text-slate-700" icon={<XCircle size={18} />} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {sites.map((site) => {
                const failed = site.status === "failed";
                const cancelled = site.status === "cancelled";
                const statusLabel = failed ? "수동 확인 필요" : cancelled ? "중지됨" : site.status === "completed" ? "검증 완료" : site.status === "processing" ? "검증 중" : "대기 중";
                return (
                  <div key={site.site} className={`rounded-2xl border p-4 ${failed ? "border-red-300 bg-red-50" : cancelled ? "border-slate-300 bg-slate-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <b>{SITE_NAMES[site.site] ?? site.site}</b>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black ${failed ? "bg-red-600 text-white" : cancelled ? "bg-slate-500 text-white" : "bg-white text-emerald-700"}`}>{statusLabel}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">완료 {site.completed.toLocaleString()} / {site.total.toLocaleString()} · 오류 {site.error.toLocaleString()}</p>
                    {site.errorReason && <p className="mt-2 break-words rounded-lg bg-white/80 px-2.5 py-2 text-xs font-bold text-red-700">원인: {site.errorReason}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">확인할 항목 {findings.length.toLocaleString()}건</h2>
              <button type="button" onClick={() => loadJob(job.id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500"><RefreshCw size={14} />새로고침</button>
            </div>
            {findings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-slate-500">
                {isRunning ? "불일치가 발견되면 여기에 표시됩니다." : "확인할 불일치가 없습니다."}
              </div>
            ) : (
              <div className="space-y-3">
                {findings.map((finding) => (
                  <article key={finding.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${finding.severity === "critical" ? "border-red-300" : finding.severity === "warning" ? "border-amber-300" : "border-slate-300"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-500">{finding.date} · {SITE_NAMES[finding.site] ?? finding.site}</p>
                        <h3 className="mt-1 text-base font-black">{finding.product}</h3>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${finding.severity === "critical" ? "bg-red-100 text-red-700" : finding.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                        {finding.severity === "critical" ? "중요" : finding.severity === "warning" ? "확인" : "오류"}
                      </span>
                    </div>
                    <p className="mt-3 font-bold text-slate-800">{finding.label}</p>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                      <p>CalApp: <b>{finding.calendarBlocked ? "예약/마감 필요" : "예약 가능"}</b></p>
                      <p>{SITE_NAMES[finding.site]}: <b>{STATE_NAMES[finding.observedState ?? "unknown"] ?? finding.observedState}</b></p>
                    </div>
                    {finding.calendarReservations?.length > 0 && (
                      <p className="mt-2 text-xs text-slate-500">CalApp 예약: {finding.calendarReservations.map((item) => `${item.guestName}(${item.room}/${item.source})`).join(", ")}</p>
                    )}
                    {finding.policyNote && <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">운영 정책: {finding.policyNote}</p>}
                    {finding.error && <p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-red-600">{finding.error}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
            </div>
          </div>
        </div>
      ) : (
        <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Clock3 size={18} /><h2 className="font-black">최근 검증</h2></div>
          <div className="mt-4 space-y-2">
            {recentJobs.map((item) => (
              <button key={item.id} type="button" onClick={() => { window.history.replaceState({}, "", `/admin/inventory-audit?id=${item.id}`); loadJob(item.id); }} className="flex w-full flex-col gap-1 rounded-xl border border-zinc-200 px-4 py-3 text-left hover:bg-zinc-50 md:flex-row md:items-center md:justify-between">
                <span>
                  <b>#{item.id}</b> · {item.from} ~ {item.to}
                  <span className="mt-1 block text-xs font-medium text-slate-500">실행 {dateTimeText(item.createdAt)}{item.completedAt ? ` · 완료 ${dateTimeText(item.completedAt)}` : ""}</span>
                </span>
                <span className="text-xs font-bold text-slate-500">중요 {item.criticalCount} · 확인 {item.warningCount} · 오류 {item.errorCount}</span>
              </button>
            ))}
            {recentJobs.length === 0 && <p className="py-8 text-center text-sm text-slate-400">아직 생성된 검증 보고서가 없습니다.</p>}
          </div>
        </section>
      )}
    </main>
  );
}
