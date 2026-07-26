import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  addNights,
  findReservationConflicts,
  parseKstDate,
  type ReservationConflict,
} from "@/lib/reservation-overlap";

export type StaySyncReservationInput = {
  reservationType: "pension" | "campnic";
  sourceRef: string;
  startDate: string;
  nights: number;
  rooms: string[];
  guestName: string;
  phone: string;
  contactName: string;
  peopleCount: number;
  totalAmount: number;
  extraAmount: number;
  depositDate: string;
  rawSummary: string;
  calendarMemo: string;
  userType: "일반" | "야수교";
  usageTime: string;
  force?: boolean;
  overrideReason?: string;
};

const PENSION_ROOMS = new Set(["101호", "201호", "202호"]);
const CAMPNIC_SESSIONS = new Set(["캠프닉1부", "캠프닉2부"]);

export function validateStaySyncInput(value: unknown): {
  data?: StaySyncReservationInput;
  error?: string;
} {
  if (!value || typeof value !== "object") return { error: "Invalid JSON body" };
  const body = value as Record<string, unknown>;

  const reservationType = String(body.reservationType ?? "pension").trim();
  const sourceRef = String(body.sourceRef ?? "").trim();
  const startDate = String(body.startDate ?? "").trim();
  const guestName = String(body.guestName ?? "").trim();
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const contactName = String(body.contactName ?? "").trim();
  const rawSummary = String(body.rawSummary ?? "").trim().slice(0, 2000);
  const calendarMemo = String(body.calendarMemo ?? "").trim().slice(0, 1000);
  const userType = String(body.userType ?? "일반").trim();
  const usageTime = String(body.usageTime ?? "").trim().slice(0, 100);
  const overrideReason = String(body.overrideReason ?? "").trim().slice(0, 300);
  const rooms = Array.from(
    new Set(
      Array.isArray(body.rooms)
        ? body.rooms.map((room) => String(room).trim()).filter(Boolean)
        : []
    )
  );
  const nights = Number(body.nights);
  const peopleCount = Number(body.peopleCount);
  const totalAmount = Number(body.totalAmount);
  const extraAmount = Number(body.extraAmount ?? 0);
  const depositDate = String(body.depositDate ?? "").trim() || startDate;
  const force = body.force === true;

  if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(sourceRef)) {
    return { error: "sourceRef must be 8-120 safe characters" };
  }
  try {
    parseKstDate(startDate);
    parseKstDate(depositDate);
  } catch {
    return { error: "startDate and depositDate must use YYYY-MM-DD" };
  }
  if (reservationType !== "pension" && reservationType !== "campnic") {
    return { error: "reservationType must be pension or campnic" };
  }
  if (
    reservationType === "pension" &&
    (!Number.isInteger(nights) || nights < 1 || nights > 30)
  ) {
    return { error: "nights must be between 1 and 30" };
  }
  const supportedCategories =
    reservationType === "campnic" ? CAMPNIC_SESSIONS : PENSION_ROOMS;
  if (rooms.length === 0 || rooms.some((room) => !supportedCategories.has(room))) {
    return {
      error:
        reservationType === "campnic"
          ? "rooms must contain supported campnic sessions"
          : "rooms must contain supported pension rooms",
    };
  }
  if (userType !== "일반" && userType !== "야수교") {
    return { error: "userType must be 일반 or 야수교" };
  }
  if (
    reservationType === "campnic" &&
    userType === "야수교" &&
    (rooms.length !== 1 || rooms[0] !== "캠프닉1부")
  ) {
    return { error: "야수교 campnic reservations must use 캠프닉1부" };
  }
  if (!guestName) return { error: "guestName is required" };
  if (!Number.isInteger(peopleCount) || peopleCount < 0 || peopleCount > 100) {
    return { error: "peopleCount is invalid" };
  }
  if (!Number.isInteger(totalAmount) || totalAmount < 0) {
    return { error: "totalAmount is invalid" };
  }
  if (!Number.isInteger(extraAmount) || extraAmount < 0) {
    return { error: "extraAmount is invalid" };
  }
  if (force && !overrideReason) {
    return { error: "overrideReason is required for forced registration" };
  }

  return {
    data: {
      reservationType,
      sourceRef,
      startDate,
      nights: reservationType === "campnic" ? 0 : nights,
      rooms,
      guestName,
      phone,
      contactName,
      peopleCount,
      totalAmount,
      extraAmount,
      depositDate,
      rawSummary,
      calendarMemo,
      userType,
      usageTime,
      force,
      overrideReason,
    },
  };
}

type ReservationDb = Pick<Prisma.TransactionClient, "reservation">;

export async function inspectStaySyncConflicts(
  input: StaySyncReservationInput,
  db: ReservationDb = prisma
): Promise<ReservationConflict[]> {
  const requestedStart = parseKstDate(input.startDate);
  if (input.reservationType === "campnic") {
    const requestedEnd = addNights(requestedStart, 1);
    const rows = await db.reservation.findMany({
      where: {
        type: "campnic",
        category: { in: input.rooms },
        payment_status: { not: "cancelled" },
        use_date: { gte: requestedStart, lt: requestedEnd },
      },
      select: {
        id: true,
        category: true,
        use_date: true,
        nights: true,
        guest_name: true,
        phone: true,
        payment_status: true,
      },
    });
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.category, (counts.get(row.category) ?? 0) + 1));
    return input.rooms.flatMap((category) =>
      (counts.get(category) ?? 0) >= 6
        ? [
            {
              id: `capacity:${category}:${input.startDate}`,
              category,
              startDate: input.startDate,
              endDate: input.startDate,
              nights: 0,
              guestName: "정원 6팀 마감",
              phone: "",
            },
          ]
        : []
    );
  }
  const requestedEnd = addNights(requestedStart, input.nights);

  const rows = await db.reservation.findMany({
    where: {
      type: "pension",
      category: { in: input.rooms },
      payment_status: { not: "cancelled" },
      use_date: { lt: requestedEnd },
    },
    select: {
      id: true,
      category: true,
      use_date: true,
      nights: true,
      guest_name: true,
      phone: true,
      payment_status: true,
    },
  });

  return findReservationConflicts(rows, requestedStart, requestedEnd);
}

export async function createStaySyncReservation(input: StaySyncReservationInput) {
  const marker = `[StaySync:${input.sourceRef}]`;
  // The reservations table uses timestamp-without-time-zone as a calendar date.
  // Match the admin API's UTC-midnight representation so YYYY-MM-DD is not
  // shifted to the previous cell when the calendar groups ISO date strings.
  const useDate = new Date(`${input.startDate}T00:00:00.000Z`);
  const depositDate = new Date(`${input.depositDate}T00:00:00.000Z`);
  const memoParts = [
    marker,
    input.reservationType === "campnic" ? `캠프닉 구분: ${input.userType}` : "",
    input.usageTime ? `이용시간: ${input.usageTime}` : "",
    input.userType === "야수교" ? "야수교" : "",
    input.contactName ? `휴대폰 연락처: ${input.contactName}` : "",
    input.calendarMemo ? `추가 메모: ${input.calendarMemo}` : "",
    input.rawSummary ? `문자 요약: ${input.rawSummary}` : "",
    input.force ? `오버부킹 강제등록 사유: ${input.overrideReason}` : "",
  ].filter(Boolean);

  return prisma.$transaction(
    async (tx) => {
      const alreadyCreated = await tx.reservation.findMany({
        where: { memo: { contains: marker } },
        orderBy: { id: "asc" },
      });
      if (alreadyCreated.length > 0) {
        return {
          duplicate: true,
          reservations: alreadyCreated.map((row) => ({
            id: row.id.toString(),
            category: row.category,
          })),
        };
      }

      const conflicts = await inspectStaySyncConflicts(input, tx);
      if (conflicts.length > 0 && !input.force) {
        return { conflicts };
      }

      const created = [];
      const chargedCategory =
        input.reservationType === "pension" && input.rooms.includes("201호")
          ? "201호"
          : input.rooms[0];
      for (const room of input.rooms) {
        created.push(
          await tx.reservation.create({
            data: {
              type: input.reservationType,
              category: room,
              use_date: useDate,
              nights: input.reservationType === "campnic" ? 0 : input.nights,
              quantity: 1,
              guest_name: input.guestName,
              phone: input.phone,
              people_count: input.peopleCount,
              user_type: input.userType,
              total_amount: room === chargedCategory ? input.totalAmount : 0,
              extra_amount: room === chargedCategory ? input.extraAmount : 0,
              payment_status: "confirmed",
              deposit_date: depositDate,
              cancel_date: depositDate,
              source: "phone",
              memo: memoParts.join("\n"),
            },
          })
        );
      }

      return {
        duplicate: false,
        reservations: created.map((row) => ({
          id: row.id.toString(),
          category: row.category,
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
