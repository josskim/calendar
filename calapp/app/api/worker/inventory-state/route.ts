import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInventoryWorkerToken } from "@/lib/worker-auth";
import { isCancelledStatus } from "@/lib/inventory-events";

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  const authError = requireInventoryWorkerToken(req);
  if (authError) return authError;

  const params = new URL(req.url).searchParams;
  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"));
  if (!from || !to || from > to) {
    return NextResponse.json(
      { error: "from and to must use YYYY-MM-DD" },
      { status: 400 }
    );
  }
  const endExclusive = new Date(to);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  if (endExclusive.getTime() - from.getTime() > 370 * 86400000) {
    return NextResponse.json({ error: "Date range is too large" }, { status: 400 });
  }

  const rows = await prisma.reservation.findMany({
    where: {
      type: "pension",
      use_date: { lt: endExclusive },
    },
    orderBy: [{ use_date: "asc" }, { id: "asc" }],
  });
  const active = rows.filter((row) => {
    if (isCancelledStatus(row.payment_status)) return false;
    const nights = Math.max(1, row.nights);
    const checkout = new Date(row.use_date);
    checkout.setUTCDate(checkout.getUTCDate() + nights);
    return checkout > from;
  });

  return NextResponse.json({
    from: params.get("from"),
    to: params.get("to"),
    reservations: active.map((row) => ({
      id: row.id.toString(),
      bookingGroupId: row.booking_group_id,
      externalRef: row.external_ref,
      version: row.sync_version,
      category: row.category,
      useDate: row.use_date.toISOString().slice(0, 10),
      nights: row.nights,
      source: row.source,
      guestName: row.guest_name,
      phone: row.phone,
      paymentStatus: row.payment_status,
    })),
  });
}
