import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FINDING_LABELS } from "@/lib/inventory-audits";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  let jobId: bigint;
  try { jobId = BigInt(id); } catch {
    return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });
  }
  const includeNormal = new URL(req.url).searchParams.get("includeNormal") === "1";
  const job = await prisma.inventory_audit_job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  const checks = await prisma.inventory_audit_check.findMany({
    where: {
      job_id: jobId,
      status: "completed",
      ...(includeNormal ? {} : { severity: { not: "normal" } }),
    },
    orderBy: [{ target_date: "asc" }, { severity: "asc" }, { site: "asc" }, { product: "asc" }],
    take: includeNormal ? 2500 : 1000,
  });
  return NextResponse.json({
    job: {
      id,
      from: job.from_date.toISOString().slice(0, 10),
      to: job.to_date.toISOString().slice(0, 10),
      status: job.status,
      totalChecks: job.total_checks,
      completedChecks: job.completed_checks,
      normalCount: job.normal_count,
      criticalCount: job.critical_count,
      warningCount: job.warning_count,
      errorCount: job.error_count,
      currentTarget: job.current_target,
      lastError: job.last_error,
      createdAt: job.created_at.toISOString(),
      startedAt: job.started_at?.toISOString() ?? null,
      completedAt: job.completed_at?.toISOString() ?? null,
    },
    findings: checks.map((check) => ({
      id: check.id.toString(),
      date: check.target_date.toISOString().slice(0, 10),
      site: check.site,
      product: check.product,
      calendarBlocked: check.calendar_blocked,
      calendarSources: check.calendar_sources,
      calendarReservations: check.calendar_reservations,
      observedState: check.observed_state,
      severity: check.severity,
      code: check.finding_code,
      label: FINDING_LABELS[check.finding_code ?? ""] ?? check.finding_code,
      details: check.observed_details,
      error: check.last_error,
      checkedAt: check.checked_at?.toISOString() ?? null,
    })),
  });
}
