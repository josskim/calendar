ALTER TABLE "reservations"
ADD COLUMN IF NOT EXISTS "sync_verified_at" TIMESTAMP(3);
