ALTER TABLE "reservations"
ADD COLUMN IF NOT EXISTS "booking_group_id" UUID,
ADD COLUMN IF NOT EXISTS "external_ref" TEXT,
ADD COLUMN IF NOT EXISTS "sync_version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "inventory_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "event_type" TEXT NOT NULL,
  "booking_group_id" UUID,
  "reservation_ids" JSONB NOT NULL,
  "reservation_version" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "result" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "inventory_events_status_available_at_id_idx"
ON "inventory_events" ("status", "available_at", "id");

CREATE INDEX IF NOT EXISTS "inventory_events_booking_group_id_id_idx"
ON "inventory_events" ("booking_group_id", "id");
