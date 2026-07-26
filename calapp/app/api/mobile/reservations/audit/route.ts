import { NextRequest, NextResponse } from "next/server";
import { requireStaySyncToken } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STAYSYNC_MARKER = /\[StaySync:([^\]]+)\]/;

export async function POST(req: NextRequest) {
  const authError = requireStaySyncToken(req);
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const from = String(body?.from ?? "");
  const to = String(body?.to ?? "");
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    return NextResponse.json({ error: "from and to must be valid YYYY-MM-DD dates" }, { status: 400 });
  }

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  const toDate = new Date(`${to}T23:59:59.999Z`);
  const rows = await prisma.reservation.findMany({
    where: {
      use_date: { gte: fromDate, lte: toDate },
      payment_status: { not: "cancelled" },
    },
    orderBy: [{ use_date: "asc" }, { id: "asc" }],
    take: 2000,
  });

  return NextResponse.json({
    from,
    to,
    reservations: rows.map((row) => ({
      id: row.id.toString(),
      reservationType: row.type,
      category: row.category,
      startDate: row.use_date.toISOString().slice(0, 10),
      nights: row.type === "pension" ? Math.max(1, row.nights) : 0,
      guestName: row.guest_name,
      phone: row.phone,
      peopleCount: row.people_count,
      totalAmount: row.total_amount,
      extraAmount: row.extra_amount,
      paymentStatus: row.payment_status,
      depositDate: row.deposit_date?.toISOString().slice(0, 10) ?? "",
      source: row.source,
      memo: row.memo,
      sourceRef: row.memo.match(STAYSYNC_MARKER)?.[1] ?? "",
      syncVerifiedAt: row.sync_verified_at?.toISOString() ?? "",
    })),
  });
}
