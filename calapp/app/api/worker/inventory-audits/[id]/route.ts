import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireInventoryWorkerToken } from "@/lib/worker-auth";
import { classifyAuditResult } from "@/lib/inventory-audits";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const authError = requireInventoryWorkerToken(req);
  if (authError) return authError;
  const { id } = await context.params;
  let jobId: bigint;
  try { jobId = BigInt(id); } catch {
    return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { results?: Array<Record<string, unknown>> } | null;
  const results = Array.isArray(body?.results) ? body.results.slice(0, 150) : [];
  if (!results.length) return NextResponse.json({ error: "results are required" }, { status: 400 });

  const activeJob = await prisma.inventory_audit_job.findUnique({ where: { id: jobId } });
  if (!activeJob) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  if (activeJob.status === "cancelled") {
    return NextResponse.json({ id, status: "cancelled", cancelled: true });
  }

  await prisma.$transaction(async (tx) => {
    for (const result of results) {
      let checkId: bigint;
      try { checkId = BigInt(String(result.checkId ?? "")); } catch { continue; }
      const check = await tx.inventory_audit_check.findFirst({ where: { id: checkId, job_id: jobId } });
      if (!check) continue;
      const error = result.error ? String(result.error).slice(0, 4000) : null;
      const observedState = result.observedState ? String(result.observedState) : null;
      const sources = Array.isArray(check.calendar_sources)
        ? check.calendar_sources.map(String)
        : [];
      const classified = classifyAuditResult({
        site: check.site,
        targetDate: check.target_date,
        product: check.product,
        calendarBlocked: check.calendar_blocked,
        calendarSources: sources,
        observedState,
        error,
      });
      await tx.inventory_audit_check.update({
        where: { id: check.id },
        data: {
          status: "completed",
          observed_state: observedState,
          severity: classified.severity,
          finding_code: classified.code,
          observed_details: (result.details ?? {}) as Prisma.InputJsonValue,
          last_error: error,
          checked_at: new Date(),
        },
      });
    }
  }, { timeout: 60_000 });

  const grouped = await prisma.inventory_audit_check.groupBy({
    by: ["severity"],
    where: { job_id: jobId, status: "completed" },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(grouped.map((row) => [row.severity ?? "error", row._count._all]));
  const completed = Object.values(counts).reduce((sum, count) => sum + Number(count), 0);
  const job = await prisma.inventory_audit_job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  if (job.status === "cancelled") {
    return NextResponse.json({ id, status: "cancelled", cancelled: true });
  }
  const done = completed >= job.total_checks;
  const updated = await prisma.inventory_audit_job.update({
    where: { id: jobId },
    data: {
      status: done ? "completed" : "processing",
      completed_checks: completed,
      normal_count: counts.normal ?? 0,
      critical_count: counts.critical ?? 0,
      warning_count: counts.warning ?? 0,
      error_count: counts.error ?? 0,
      current_target: done ? null : job.current_target,
      completed_at: done ? new Date() : null,
      summary: counts as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({
    id,
    status: updated.status,
    completedChecks: updated.completed_checks,
    totalChecks: updated.total_checks,
    criticalCount: updated.critical_count,
    warningCount: updated.warning_count,
    errorCount: updated.error_count,
  });
}
