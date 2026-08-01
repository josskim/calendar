import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FINDING_LABELS,
  isNaverSaturdayIndividualPolicy,
  NAVER_SATURDAY_POLICY_NOTE,
} from "@/lib/inventory-audits";

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
  const [checks, siteRows, siteErrors] = await Promise.all([
    prisma.inventory_audit_check.findMany({
    where: {
      job_id: jobId,
      status: "completed",
      ...(includeNormal ? {} : { severity: { not: "normal" } }),
    },
    orderBy: [{ target_date: "asc" }, { severity: "asc" }, { site: "asc" }, { product: "asc" }],
    take: includeNormal ? 2500 : 1000,
    }),
    prisma.inventory_audit_check.groupBy({
      by: ["site", "status", "severity"],
      where: { job_id: jobId },
      _count: { _all: true },
    }),
    prisma.inventory_audit_check.findMany({
      where: { job_id: jobId, severity: "error" },
      orderBy: [{ site: "asc" }, { target_date: "asc" }],
      select: { site: true, last_error: true },
      take: 100,
    }),
  ]);
  const siteSummaries = new Map<string, {
    site: string;
    total: number;
    completed: number;
    normal: number;
    critical: number;
    warning: number;
    error: number;
    cancelled: number;
    errorReason: string | null;
  }>();
  for (const row of siteRows) {
    const summary = siteSummaries.get(row.site) ?? {
      site: row.site, total: 0, completed: 0, normal: 0, critical: 0,
      warning: 0, error: 0, cancelled: 0, errorReason: null,
    };
    const count = row._count._all;
    summary.total += count;
    if (row.status === "completed") summary.completed += count;
    if (row.status === "cancelled") summary.cancelled += count;
    if (row.severity === "normal") summary.normal += count;
    if (row.severity === "critical") summary.critical += count;
    if (row.severity === "warning") summary.warning += count;
    if (row.severity === "error") summary.error += count;
    siteSummaries.set(row.site, summary);
  }
  for (const row of siteErrors) {
    const summary = siteSummaries.get(row.site);
    if (summary && !summary.errorReason && row.last_error) summary.errorReason = row.last_error;
  }
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
      policyNote: isNaverSaturdayIndividualPolicy(check.site, check.target_date, check.product)
        ? NAVER_SATURDAY_POLICY_NOTE
        : null,
      checkedAt: check.checked_at?.toISOString() ?? null,
    })),
    sites: [...siteSummaries.values()].map((site) => ({
      ...site,
      status: site.error > 0
        ? "failed"
        : site.completed === site.total
          ? "completed"
          : job.status === "cancelled"
            ? "cancelled"
            : site.completed > 0
              ? "processing"
              : "pending",
    })),
  });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  let jobId: bigint;
  try { jobId = BigInt(id); } catch {
    return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });
  }
  const job = await prisma.inventory_audit_job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  if (!["pending", "processing"].includes(job.status)) {
    return NextResponse.json({ id, status: job.status, cancelled: false });
  }
  await prisma.$transaction([
    prisma.inventory_audit_check.updateMany({
      where: { job_id: jobId, status: { in: ["pending", "processing"] } },
      data: { status: "cancelled", claimed_at: null },
    }),
    prisma.inventory_audit_job.update({
      where: { id: jobId },
      data: {
        status: "cancelled",
        current_target: null,
        last_error: "사용자가 중지한 검증",
        completed_at: new Date(),
      },
    }),
  ]);
  return NextResponse.json({ id, status: "cancelled", cancelled: true });
}
