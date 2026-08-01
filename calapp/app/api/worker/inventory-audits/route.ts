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
  const requested = Number(new URL(req.url).searchParams.get("limit") ?? 150);
  const limit = Math.max(1, Math.min(150, Number.isFinite(requested) ? requested : 150));

  const checks = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedCheck[]>(Prisma.sql`
      WITH selected_check AS (
        SELECT job.id AS job_id, check_row.site,
               date_trunc('month', check_row.target_date) AS target_month
        FROM inventory_audit_jobs job
        JOIN inventory_audit_checks check_row ON check_row.job_id = job.id
        WHERE job.status IN ('pending', 'processing')
          AND (
            check_row.status = 'pending'
            OR (check_row.status = 'processing' AND check_row.claimed_at < NOW() - INTERVAL '10 minutes')
          )
        ORDER BY job.id, check_row.site, check_row.target_date, check_row.product
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      ), candidates AS (
        SELECT check_row.id
        FROM inventory_audit_checks check_row
        JOIN selected_check ON selected_check.job_id = check_row.job_id
          AND selected_check.site = check_row.site
          AND selected_check.target_month = date_trunc('month', check_row.target_date)
        WHERE (
          check_row.status = 'pending'
          OR (check_row.status = 'processing' AND check_row.claimed_at < NOW() - INTERVAL '10 minutes')
        )
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
      const job = await tx.inventory_audit_job.findUnique({
        where: { id: rows[0].job_id },
        select: { started_at: true },
      });
      await tx.inventory_audit_job.update({
        where: { id: rows[0].job_id },
        data: {
          status: "processing",
          started_at: job?.started_at ?? new Date(),
          current_target: `${current} 외 ${rows.length - 1}건 월간 일괄 확인`,
        },
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
