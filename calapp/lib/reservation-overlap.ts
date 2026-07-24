export const KST_OFFSET = "+09:00";

export type ExistingReservation = {
  id: bigint;
  category: string;
  use_date: Date;
  nights: number;
  guest_name: string;
  phone: string;
  payment_status: string;
};

export type ReservationConflict = {
  id: string;
  category: string;
  startDate: string;
  endDate: string;
  nights: number;
  guestName: string;
  phone: string;
};

export function parseKstDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD");
  }
  const parsed = new Date(`${value}T00:00:00${KST_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  return parsed;
}

export function addNights(start: Date, nights: number): Date {
  const result = new Date(start);
  result.setUTCDate(result.getUTCDate() + nights);
  return result;
}

export function toKstDate(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function overlaps(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function findReservationConflicts(
  rows: ExistingReservation[],
  requestedStart: Date,
  requestedEnd: Date
): ReservationConflict[] {
  return rows
    .filter((row) => {
      const existingEnd = addNights(row.use_date, Math.max(1, row.nights));
      return overlaps(row.use_date, existingEnd, requestedStart, requestedEnd);
    })
    .map((row) => {
      const nights = Math.max(1, row.nights);
      return {
        id: row.id.toString(),
        category: row.category,
        startDate: toKstDate(row.use_date),
        endDate: toKstDate(addNights(row.use_date, nights)),
        nights,
        guestName: row.guest_name,
        phone: row.phone,
      };
    });
}
