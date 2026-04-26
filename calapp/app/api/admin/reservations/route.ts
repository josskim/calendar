import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  if (!year || !month) {
    return NextResponse.json(
      { error: "year and month required" },
      { status: 400 }
    );
  }
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  try {
    const list = await prisma.reservation.findMany({
      where: {
        use_date: { gte: start, lte: end },
      },
      orderBy: { use_date: "asc" },
    });

    return NextResponse.json(
      list.map((r) => ({
        id: r.id.toString(),
        type: r.type,
        category: r.category,
        use_date: r.use_date.toISOString(),
        nights: r.nights,
        quantity: r.quantity,
        guest_name: r.guest_name,
        phone: r.phone,
        people_count: r.people_count,
        user_type: r.user_type,
        total_amount: r.total_amount,
        extra_amount: r.extra_amount,
        payment_status: r.payment_status,
        deposit_date: r.deposit_date.toISOString(),
        cancel_date: r.cancel_date.toISOString(),
        source: r.source,
        memo: r.memo,
      }))
    );
  } catch (error: any) {
    console.error("Failed to fetch reservations:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch reservations", 
        details: error.message,
        code: error.code // Prisma error code
      }, 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const use_date = body.use_date as string | undefined;
  const deposit_date = body.deposit_date as string | undefined;
  const cancel_date = body.cancel_date as string | undefined;
  if (!use_date || !deposit_date) {
    return NextResponse.json(
      { error: "use_date and deposit_date required" },
      { status: 400 }
    );
  }

  const type = String(body.type ?? "pension").trim();
  const category = String(body.category ?? "").trim();
  const guest_name = String(body.guest_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const user_type = String(body.user_type ?? "일반").trim();
  const payment_status = String(body.payment_status ?? "confirmed").trim();
  const source = String(body.source ?? "other").trim();
  const memo = String(body.memo ?? "").trim();
  const nights = Number(body.nights) || 0;
  const quantity = Number(body.quantity) || 0;
  const people_count = Number(body.people_count) || 0;
  const total_amount = Number(body.total_amount) || 0;
  const extra_amount = Number(body.extra_amount) || 0;

  if (!category || !guest_name) {
    return NextResponse.json(
      { error: "category, guest_name required" },
      { status: 400 }
    );
  }

  const useDate = new Date(use_date);
  const depositDate = new Date(deposit_date);
  const cancelDate = cancel_date ? new Date(cancel_date) : depositDate;

  // 예약 제한 체크
  const startOfDay = new Date(useDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(useDate);
  endOfDay.setHours(23, 59, 59, 999);

  if (type === "pension") {
    const existing = await prisma.reservation.findFirst({
      where: {
        use_date: { gte: startOfDay, lte: endOfDay },
        category,
        payment_status: { not: "cancelled" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "이미 예약된 호실입니다." }, { status: 400 });
    }
  } else if (type === "campnic") {
    const count = await prisma.reservation.count({
      where: {
        use_date: { gte: startOfDay, lte: endOfDay },
        category,
        payment_status: { not: "cancelled" },
      },
    });
    if (count >= 6) {
      return NextResponse.json({ error: "해당 시간대 캠프닉 예약이 마감되었습니다. (최대 6팀)" }, { status: 400 });
    }
  }

  const created = await prisma.reservation.create({
    data: {
      type,
      category,
      use_date: useDate,
      nights,
      quantity,
      guest_name,
      phone,
      people_count,
      user_type,
      total_amount,
      extra_amount,
      payment_status,
      deposit_date: depositDate,
      cancel_date: cancelDate,
      source,
      memo,
    },
  });

  return NextResponse.json({
    id: created.id.toString(),
    use_date: created.use_date.toISOString(),
  });
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const use_date = body.use_date as string | undefined;
  const deposit_date = body.deposit_date as string | undefined;
  const cancel_date = body.cancel_date as string | undefined;

  const type = String(body.type ?? "pension").trim();
  const category = String(body.category ?? "").trim();
  const guest_name = String(body.guest_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const user_type = String(body.user_type ?? "일반").trim();
  const payment_status = String(body.payment_status ?? "confirmed").trim();
  const source = String(body.source ?? "other").trim();
  const memo = String(body.memo ?? "").trim();
  const nights = Number(body.nights) || 0;
  const quantity = Number(body.quantity) || 0;
  const people_count = Number(body.people_count) || 0;
  const total_amount = Number(body.total_amount) || 0;
  const extra_amount = Number(body.extra_amount) || 0;

  const updateData: any = {
    type,
    category,
    nights,
    quantity,
    guest_name,
    phone,
    people_count,
    user_type,
    total_amount,
    extra_amount,
    payment_status,
    source,
    memo,
  };

  if (use_date) updateData.use_date = new Date(use_date);
  if (deposit_date) updateData.deposit_date = new Date(deposit_date);
  if (cancel_date) {
    updateData.cancel_date = new Date(cancel_date);
  } else if (deposit_date) {
    updateData.cancel_date = new Date(deposit_date);
  }

  // 예약 제한 체크 (본인 제외)
  const targetDate = updateData.use_date || (await prisma.reservation.findUnique({ where: { id: BigInt(id) } }))?.use_date;
  if (targetDate) {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    if (type === "pension") {
      const existing = await prisma.reservation.findFirst({
        where: {
          id: { not: BigInt(id) },
          use_date: { gte: startOfDay, lte: endOfDay },
          category,
          payment_status: { not: "cancelled" },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "이미 예약된 호실입니다." }, { status: 400 });
      }
    } else if (type === "campnic") {
      const count = await prisma.reservation.count({
        where: {
          id: { not: BigInt(id) },
          use_date: { gte: startOfDay, lte: endOfDay },
          category,
          payment_status: { not: "cancelled" },
        },
      });
      if (count >= 6) {
        return NextResponse.json({ error: "해당 시간대 캠프닉 정원(6팀)이 가득 찼습니다." }, { status: 400 });
      }
    }
  }

  try {
    const updated = await prisma.reservation.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id.toString(),
      use_date: updated.use_date.toISOString(),
    });
  } catch (e) {
    console.error("Update failed:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
