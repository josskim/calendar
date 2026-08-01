import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireInventoryWorkerToken } from "@/lib/worker-auth";

type ClaimedCheck = {
  id: bigint;
  job_id: bigint;
  site: string;
  target_date: Date;
  product: string;
  calendar_blocked: boolean;
  calendar_sources: Prisma.JsonValue;
  calendar_reservations: Prisma.JsonValue;
};

export async function GET(req: NextRequest) {
  const authError = requireInventoryWorkerToken(req);
  if (authError) return authError;
  const requested = Number(new URL(req.url).searchParams.get("limit") ?? 4);
  const limit = Math.max(1, Math.min(8, Number.isFinite(requested) ? requested : 4));

  const checks = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedCheck[]>(Prisma.sql`
      WITH selected_job AS (
        SELECT job.id
        FROM inventory_audit_jobs job
        WHERE job.status IN ('pending', 'processing')
          AND EXISTS (
            SELECT 1 FROM inventory_audit_checks check_row
            WHERE check_row.job_id = job.id
              AND (
                check_row.status = 'pending'
                OR (check_row.status = 'processing' AND check_row.claimed_at < NOW() - INTERVAL '10 minutes')
              )
          )
        ORDER BY job.id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      ), candidates AS (
        SELECT check_row.id
        FROM inventory_audit_checks check_row
        JOIN selected_job ON selected_job.id = check_row.job_id
        WHERE check_row.status = 'pending'
           OR (check_row.status = 'processing' AND check_row.claimed_at < NOW() - INTERVAL '10 minutes')
        ORDER BY check_row.site, check_row.target_date, check_row.product
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE inventory_audit_checks AS check_row
      SET status = 'processing', claimed_at = NOW(),
          attempt_count = check_row.attempt_count + 1, updated_at = NOW()
      FROM candidates
      WHERE check_row.id = candidates.id
      RETURNING check_row.id, check_row.job_id, check_row.site,
                check_row.target_date, check_row.product, check_row.calendar_blocked,
                check_row.calendar_sources, check_row.calendar_reservations
    `);
    if (rows.length) {
      const current = `${rows[0].site}:${rows[0].target_date.toISOString().slice(0, 10)}:${rows[0].product}`;
      await tx.inventory_audit_job.update({
        where: { id: rows[0].job_id },
        data: { status: "processing", started_at: new Date(), current_target: current },
      });
    }
    return rows;
  });

  return NextResponse.json({
    jobId: checks[0]?.job_id.toString() ?? null,
    checks: checks.map((check) => ({
      id: check.id.toString(),
      site: check.site,
      date: check.target_date.toISOString().slice(0, 10),
      product: check.product,
      calendarBlocked: check.calendar_blocked,
      calendarSources: check.calendar_sources,
      calendarReservations: check.calendar_reservations,
    })),
  });
}
