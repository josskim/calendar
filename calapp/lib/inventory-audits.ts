import { Prisma } from "@prisma/client";
import { isCancelledStatus } from "@/lib/inventory-events";

export const AUDIT_SITES = ["naver", "yanolja", "goodchoice", "airbnb"] as const;
export type AuditSite = (typeof AUDIT_SITES)[number];

const AUDIT_SITE_ORDER = new Map<string, number>(
  AUDIT_SITES.map((site, index) => [site, index])
);

export const NAVER_SATURDAY_POLICY_NOTE =
  "토요일은 201호·202호 단독 상품을 닫고 201호+202호 묶음 상품만 판매합니다.";

const COMBINED_201_202_PRODUCT = "201+202호 (독채)";

export function isNaverSaturdayIndividualPolicy(
  site: string,
  targetDate: Date,
  product: string
): boolean {
  return site === "naver" && targetDate.getUTCDay() === 6 && ["201호", "202호"].includes(product);
}

type AuditTarget = { site: string; product: string };
type AuditReservation = {
  id: bigint;
  type: string;
  category: string;
  use_date: Date;
  nights: number;
  payment_status: string;
  source: string;
  guest_name: string;
};

export function targetsForRoom(room: string): AuditTarget[] {
  const targets: AuditTarget[] = [
    { site: "yanolja", product: room },
    { site: "goodchoice", product: room },
  ];
  if (room === "101호") {
    targets.push(
      { site: "naver", product: "101호(독채)" },
      { site: "airbnb", product: "101호(독채)" }
    );
  } else if (room === "201호" || room === "202호") {
    targets.push(
      { site: "naver", product: room },
      { site: "naver", product: "201호+202호(독채)" },
      { site: "yanolja", product: COMBINED_201_202_PRODUCT },
      { site: "goodchoice", product: COMBINED_201_202_PRODUCT },
      { site: "airbnb", product: "독채 (201호+202호)" }
    );
  }
  return targets;
}

export function allTargetsForDay(selectedSites: readonly AuditSite[] = AUDIT_SITES): AuditTarget[] {
  const selected = new Set<string>(selectedSites);
  const unique = new Map<string, AuditTarget>();
  for (const room of ["101호", "201호", "202호"]) {
    for (const target of targetsForRoom(room)) {
      if (!selected.has(target.site)) continue;
      unique.set(`${target.site}:${target.product}`, target);
    }
  }
  return [...unique.values()].sort((a, b) =>
    (AUDIT_SITE_ORDER.get(a.site) ?? AUDIT_SITES.length) -
      (AUDIT_SITE_ORDER.get(b.site) ?? AUDIT_SITES.length) ||
    a.product.localeCompare(b.product, "ko")
  );
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseAuditDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildAuditChecks(
  reservations: AuditReservation[],
  from: Date,
  to: Date,
  selectedSites: readonly AuditSite[] = AUDIT_SITES
): Array<{
  site: string;
  target_date: Date;
  product: string;
  calendar_blocked: boolean;
  calendar_sources: Prisma.InputJsonValue;
  calendar_reservations: Prisma.InputJsonValue;
}> {
  const checks = new Map<
    string,
    {
      site: string;
      target_date: Date;
      product: string;
      calendar_blocked: boolean;
      sources: Set<string>;
      reservations: Map<string, { id: string; guestName: string; room: string; source: string }>;
    }
  >();
  const targets = allTargetsForDay(selectedSites);
  for (let cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = new Date(cursor);
    for (const target of targets) {
      const key = `${target.site}:${dayKey(date)}:${target.product}`;
      checks.set(key, {
        ...target,
        target_date: date,
        calendar_blocked: false,
        sources: new Set(),
        reservations: new Map(),
      });
    }
  }

  for (const reservation of reservations) {
    if (
      reservation.type !== "pension" ||
      !["101호", "201호", "202호"].includes(reservation.category) ||
      isCancelledStatus(reservation.payment_status)
    ) continue;
    const nights = Math.max(1, reservation.nights || 1);
    for (let offset = 0; offset < nights; offset += 1) {
      const occupied = new Date(reservation.use_date);
      occupied.setUTCDate(occupied.getUTCDate() + offset);
      if (occupied < from || occupied > to) continue;
      for (const target of targetsForRoom(reservation.category)) {
        const key = `${target.site}:${dayKey(occupied)}:${target.product}`;
        const check = checks.get(key);
        if (!check) continue;
        check.calendar_blocked = true;
        check.sources.add(reservation.source);
        check.reservations.set(reservation.id.toString(), {
          id: reservation.id.toString(),
          guestName: reservation.guest_name,
          room: reservation.category,
          source: reservation.source,
        });
      }
    }
  }

  return [...checks.values()].map((check) => ({
    site: check.site,
    target_date: check.target_date,
    product: check.product,
    calendar_blocked: check.calendar_blocked,
    calendar_sources: [...check.sources].sort() as Prisma.InputJsonValue,
    calendar_reservations: [...check.reservations.values()] as Prisma.InputJsonValue,
  }));
}

const NATIVE_SOURCE: Record<string, string> = {
  naver: "naver",
  yanolja: "nol",
  goodchoice: "here",
  airbnb: "airbnb",
};

export function classifyAuditResult(input: {
  site: string;
  targetDate: Date;
  product: string;
  calendarBlocked: boolean;
  calendarSources: string[];
  observedState?: string | null;
  error?: string | null;
}): { severity: "normal" | "critical" | "warning" | "error"; code: string } {
  if (input.error || !input.observedState || input.observedState === "unknown") {
    return { severity: "error", code: "inspection_error" };
  }
  const state = input.observedState;
  if (input.site === "naver" && state === "not_on_sale") {
    return { severity: "warning", code: "naver_sales_not_open" };
  }
  const saturdayIndividualPolicy = isNaverSaturdayIndividualPolicy(
    input.site,
    input.targetDate,
    input.product
  );
  if (!input.calendarBlocked && saturdayIndividualPolicy) {
    if (state === "blocked_by_host") {
      return { severity: "normal", code: "matched_naver_saturday_policy" };
    }
    if (state === "open") {
      return { severity: "warning", code: "naver_saturday_individual_open" };
    }
    if (state === "blocked_by_booking") {
      return { severity: "critical", code: "external_booking_missing_calapp" };
    }
  }
  if (input.calendarBlocked) {
    if (state === "open") {
      return { severity: "critical", code: "calendar_reserved_site_open" };
    }
    if (state === "blocked_by_booking") {
      return input.calendarSources.includes(NATIVE_SOURCE[input.site])
        ? { severity: "normal", code: "matched_native_booking" }
        : { severity: "critical", code: "unexpected_external_booking" };
    }
    if (state === "blocked_by_host") {
      return { severity: "normal", code: "matched_host_block" };
    }
  } else {
    if (state === "open") return { severity: "normal", code: "matched_open" };
    if (state === "blocked_by_booking") {
      return { severity: "critical", code: "external_booking_missing_calapp" };
    }
    if (state === "blocked_by_host") {
      return { severity: "warning", code: "unnecessary_site_block" };
    }
  }
  return { severity: "error", code: "unexpected_state" };
}

export const FINDING_LABELS: Record<string, string> = {
  calendar_reserved_site_open: "CalApp 예약인데 외부 사이트 판매 허용",
  unexpected_external_booking: "CalApp 예약과 별개의 외부 예약 충돌 의심",
  external_booking_missing_calapp: "외부 예약이 있으나 CalApp 미등록 의심",
  unnecessary_site_block: "CalApp 예약 가능인데 외부 사이트 마감",
  inspection_error: "사이트 상태 확인 실패",
  unexpected_state: "알 수 없는 상태",
  matched_native_booking: "외부 예약과 CalApp 일치",
  matched_host_block: "CalApp 예약과 사이트 차단 일치",
  matched_open: "양쪽 모두 예약 가능",
  matched_naver_saturday_policy: "네이버 토요일 단독 상품 정책과 일치",
  naver_saturday_individual_open: "확인 필요: 네이버 토요일 201호·202호 단독 상품이 예약 가능",
  naver_sales_not_open: "네이버 예약이 아직 열리지 않음",
};
