import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  addNights,
  findReservationConflicts,
  parseKstDate,
} from "@/lib/reservation-overlap";

export type StaySyncReservationInput = {
  sourceRef: string;
  startDate: string;
  nights: number;
  rooms: string[];
  guestName: string;
  phone: string;
  contactName: string;
  peopleCount: number;
  totalAmount: number;
  depositDate: string;
  rawSummary: string;
  force?: boolean;
  overrideReason?: string;
};

const PENSION_ROOMS = new Set(["101호", "201호", "202호"]);

export function validateStaySyncInput(value: unknown): {
  data?: StaySyncReservationInput;
  error?: string;
} {
  if (!value || typeof value !== "object") return { error: "Invalid JSON body" };
  const body = value as Record<string, unknown>;

  const sourceRef = String(body.sourceRef ?? "").trim();
  const startDate = String(body.startDate ?? "").trim();
  const guestName = String(body.guestName ?? "").trim();
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const contactName = String(body.contactName ?? "").trim();
  const rawSummary = String(body.rawSummary ?? "").trim().slice(0, 2000);
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
  if (!Number.isInteger(nights) || nights < 1 || nights > 30) {
    return { error: "nights must be between 1 and 30" };
  }
  if (rooms.length === 0 || rooms.some((room) => !PENSION_ROOMS.has(room))) {
    return { error: "rooms must contain supported pension rooms" };
  }
  if (!guestName) return { error: "guestName is required" };
  if (!Number.isInteger(peopleCount) || peopleCount < 0 || peopleCount > 100) {
    return { error: "peopleCount is invalid" };
  }
  if (!Number.isInteger(totalAmount) || totalAmount < 0) {
    return { error: "totalAmount is invalid" };
  }
  if (force && !overrideReason) {
    return { error: "overrideReason is required for forced registration" };
  }

  return {
    data: {
      sourceRef,
      startDate,
      nights,
      rooms,
      guestName,
      phone,
      contactName,
      peopleCount,
      totalAmount,
      depositDate,
      rawSummary,
      force,
      overrideReason,
    },
  };
}

type ReservationDb = Pick<Prisma.TransactionClient, "reservation">;

export async function inspectStaySyncConflicts(
  input: StaySyncReservationInput,
  db: ReservationDb = prisma
) {
  const requestedStart = parseKstDate(input.startDate);
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
  const useDate = parseKstDate(input.startDate);
  const depositDate = parseKstDate(input.depositDate);
  const memoParts = [
    marker,
    input.contactName ? `휴대폰 연락처: ${input.contactName}` : "",
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
      for (const [index, room] of input.rooms.entries()) {
        created.push(
          await tx.reservation.create({
            data: {
              type: "pension",
              category: room,
              use_date: useDate,
              nights: input.nights,
              quantity: 1,
              guest_name: input.guestName,
              phone: input.phone,
              people_count: input.peopleCount,
              user_type: "일반",
              total_amount: index === 0 ? input.totalAmount : 0,
              extra_amount: 0,
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
