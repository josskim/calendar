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
      // Legacy/admin reservations can be stored at UTC midnight while StaySync
      // reservations are stored at KST midnight. Treat both as calendar dates so
      // checkout day and the next guest's check-in day never overlap.
      const existingStart = parseKstDate(toKstDate(row.use_date));
      const existingEnd = addNights(existingStart, Math.max(1, row.nights));
      return overlaps(existingStart, existingEnd, requestedStart, requestedEnd);
    })
    .map((row) => {
      const nights = Math.max(1, row.nights);
      const existingStart = parseKstDate(toKstDate(row.use_date));
      return {
        id: row.id.toString(),
        category: row.category,
        startDate: toKstDate(existingStart),
        endDate: toKstDate(addNights(existingStart, nights)),
        nights,
        guestName: row.guest_name,
        phone: row.phone,
      };
    });
}
