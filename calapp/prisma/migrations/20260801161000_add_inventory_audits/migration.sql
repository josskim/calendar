CREATE TABLE "inventory_audit_jobs" (
  "id" BIGSERIAL NOT NULL,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "total_checks" INTEGER NOT NULL DEFAULT 0,
  "completed_checks" INTEGER NOT NULL DEFAULT 0,
  "normal_count" INTEGER NOT NULL DEFAULT 0,
  "critical_count" INTEGER NOT NULL DEFAULT 0,
  "warning_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "current_target" TEXT,
  "summary" JSONB,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_audit_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_audit_checks" (
  "id" BIGSERIAL NOT NULL,
  "job_id" BIGINT NOT NULL,
  "site" TEXT NOT NULL,
  "target_date" DATE NOT NULL,
  "product" TEXT NOT NULL,
  "calendar_blocked" BOOLEAN NOT NULL,
  "calendar_sources" JSONB NOT NULL,
  "calendar_reservations" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "observed_state" TEXT,
  "severity" TEXT,
  "finding_code" TEXT,
  "observed_details" JSONB,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "claimed_at" TIMESTAMPTZ,
  "checked_at" TIMESTAMPTZ,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_audit_checks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_audit_checks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "inventory_audit_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "inventory_audit_jobs_status_id_idx" ON "inventory_audit_jobs"("status", "id");
CREATE UNIQUE INDEX "inventory_audit_checks_job_id_site_target_date_product_key" ON "inventory_audit_checks"("job_id", "site", "target_date", "product");
CREATE INDEX "inventory_audit_checks_job_id_status_site_target_date_idx" ON "inventory_audit_checks"("job_id", "status", "site", "target_date");
CREATE INDEX "inventory_audit_checks_job_id_severity_target_date_idx" ON "inventory_audit_checks"("job_id", "severity", "target_date");
