import { NextRequest, NextResponse } from "next/server";
import { requireStaySyncToken } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const ID_PATTERN = /^\d+$/;

export async function POST(req: NextRequest) {
  const authError = requireStaySyncToken(req);
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const rawIds = Array.isArray(body?.reservationIds) ? body.reservationIds : [];
  const ids = [...new Set(rawIds.map(String))];
  if (ids.length === 0 || ids.length > 200 || ids.some((id) => !ID_PATTERN.test(id))) {
    return NextResponse.json(
      { error: "reservationIds must contain 1 to 200 numeric ids" },
      { status: 400 },
    );
  }

  const reservationIds = ids.map(BigInt);
  const existing = await prisma.reservation.findMany({
    where: {
      id: { in: reservationIds },
      payment_status: { not: "cancelled" },
    },
    select: { id: true },
  });
  if (existing.length !== reservationIds.length) {
    return NextResponse.json(
      { error: "검증할 예약 중 삭제되었거나 취소된 항목이 있습니다." },
      { status: 409 },
    );
  }

  const verifiedAt = new Date();
  await prisma.reservation.updateMany({
    where: { id: { in: reservationIds } },
    data: { sync_verified_at: verifiedAt },
  });

  return NextResponse.json({
    success: true,
    verifiedAt: verifiedAt.toISOString(),
    reservationIds: ids,
  });
}
