import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireInventoryWorkerToken } from "@/lib/worker-auth";

type ClaimedEvent = {
  id: bigint;
  event_type: string;
  booking_group_id: string | null;
  reservation_ids: Prisma.JsonValue;
  reservation_version: number;
  payload: Prisma.JsonValue;
  attempt_count: number;
  created_at: Date;
};

export async function GET(req: NextRequest) {
  const authError = requireInventoryWorkerToken(req);
  if (authError) return authError;

  const requestedLimit = Number(new URL(req.url).searchParams.get("limit") ?? 5);
  const limit = Math.max(1, Math.min(20, Number.isFinite(requestedLimit) ? requestedLimit : 5));

  const events = await prisma.$transaction(async (tx) => {
    return tx.$queryRaw<ClaimedEvent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT id
        FROM inventory_events
        WHERE (
          (status IN ('pending', 'retrying') AND available_at <= NOW())
          OR (status = 'processing' AND claimed_at < NOW() - INTERVAL '10 minutes')
        )
        ORDER BY id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE inventory_events AS event
      SET status = 'processing',
          claimed_at = NOW(),
          attempt_count = event.attempt_count + 1,
          updated_at = NOW()
      FROM candidates
      WHERE event.id = candidates.id
      RETURNING event.id,
                event.event_type,
                event.booking_group_id,
                event.reservation_ids,
                event.reservation_version,
                event.payload,
                event.attempt_count,
                event.created_at
    `);
  });

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id.toString(),
      eventType: event.event_type,
      bookingGroupId: event.booking_group_id,
      reservationIds: event.reservation_ids,
      reservationVersion: event.reservation_version,
      payload: event.payload,
      attemptCount: event.attempt_count,
      createdAt: event.created_at.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const authError = requireInventoryWorkerToken(req);
  if (authError) return authError;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const from = String(body?.from ?? "");
  const to = String(body?.to ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from and to must use YYYY-MM-DD" }, { status: 400 });
  }
  const event = await prisma.$transaction((tx) =>
    tx.inventory_event.create({
      data: {
        event_type: "inventory.reconcile",
        booking_group_id: null,
        reservation_ids: [],
        payload: { before: [], after: [], reason: "manual", metadata: { from, to } },
      },
    })
  );
  return NextResponse.json({ id: event.id.toString(), status: event.status }, { status: 201 });
}
