import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

export const INVENTORY_EVENT_TYPES = {
  created: "reservation.created",
  updated: "reservation.updated",
  cancelled: "reservation.cancelled",
  reactivated: "reservation.reactivated",
  reconcile: "inventory.reconcile",
} as const;

export type InventoryEventType =
  (typeof INVENTORY_EVENT_TYPES)[keyof typeof INVENTORY_EVENT_TYPES];

export type InventoryReservationSnapshot = {
  id: string;
  bookingGroupId: string | null;
  externalRef: string | null;
  version: number;
  type: string;
  category: string;
  useDate: string;
  nights: number;
  paymentStatus: string;
  source: string;
  guestName: string;
  phone: string;
  updatedAt: string;
};

type SnapshotSource = {
  id: bigint;
  booking_group_id: string | null;
  external_ref: string | null;
  sync_version: number;
  type: string;
  category: string;
  use_date: Date;
  nights: number;
  payment_status: string;
  source: string;
  guest_name: string;
  phone: string;
  updated_at: Date;
};

type EventDb = Pick<Prisma.TransactionClient, "inventory_event">;
const INVENTORY_DEBOUNCE_MS = 3 * 60 * 1000;

export function newBookingGroupId(): string {
  return randomUUID();
}

export function isCancelledStatus(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "cancelled" || normalized === "취소";
}

export function snapshotReservation(
  row: SnapshotSource
): InventoryReservationSnapshot {
  return {
    id: row.id.toString(),
    bookingGroupId: row.booking_group_id,
    externalRef: row.external_ref,
    version: row.sync_version,
    type: row.type,
    category: row.category,
    useDate: row.use_date.toISOString(),
    nights: row.nights,
    paymentStatus: row.payment_status,
    source: row.source,
    guestName: row.guest_name,
    phone: row.phone,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function enqueueInventoryEvent(
  db: EventDb,
  input: {
    eventType: InventoryEventType;
    bookingGroupId: string | null;
    reservationVersion: number;
    before?: InventoryReservationSnapshot[];
    after?: InventoryReservationSnapshot[];
    reason?: string;
    metadata?: Prisma.InputJsonObject;
  }
) {
  const availableAt = new Date(Date.now() + INVENTORY_DEBOUNCE_MS);
  const before = input.before ?? [];
  const after = input.after ?? [];
  const reservationIds = Array.from(
    new Set([...before, ...after].map((row) => row.id))
  );

  // Direct CalApp entry may save one room at a time. Every new reservation
  // change extends the pending batch so the worker sees the final calendar
  // state three minutes after the operator's last save.
  await db.inventory_event.updateMany({
    where: { status: "pending" },
    data: { available_at: availableAt },
  });

  return db.inventory_event.create({
    data: {
      event_type: input.eventType,
      booking_group_id: input.bookingGroupId,
      reservation_ids: reservationIds,
      reservation_version: input.reservationVersion,
      available_at: availableAt,
      payload: {
        before,
        after,
        reason: input.reason ?? null,
        metadata: input.metadata ?? {},
      },
    },
  });
}

export function eventTypeForStatusChange(
  beforeStatus: string,
  afterStatus: string
): InventoryEventType {
  const wasCancelled = isCancelledStatus(beforeStatus);
  const isCancelled = isCancelledStatus(afterStatus);
  if (!wasCancelled && isCancelled) return INVENTORY_EVENT_TYPES.cancelled;
  if (wasCancelled && !isCancelled) return INVENTORY_EVENT_TYPES.reactivated;
  return INVENTORY_EVENT_TYPES.updated;
}
