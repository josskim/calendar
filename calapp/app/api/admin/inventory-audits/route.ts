import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AUDIT_SITES,
  type AuditSite,
  allTargetsForDay,
  buildAuditChecks,
  parseAuditDate,
} from "@/lib/inventory-audits";

function dateText(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function GET() {
  const jobs = await prisma.inventory_audit_job.findMany({
    orderBy: { id: "desc" },
    take: 20,
  });
  return NextResponse.json({
    jobs: jobs.map((job) => ({
      id: job.id.toString(),
      from: dateText(job.from_date),
      to: dateText(job.to_date),
      status: job.status,
      totalChecks: job.total_checks,
      completedChecks: job.completed_checks,
      normalCount: job.normal_count,
      criticalCount: job.critical_count,
      warningCount: job.warning_count,
      errorCount: job.error_count,
      currentTarget: job.current_target,
      createdAt: job.created_at.toISOString(),
      completedAt: job.completed_at?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const fromText = String(body?.from ?? "");
  const toText = String(body?.to ?? "");
  const requestedSites = Array.isArray(body?.sites) ? body.sites.map(String) : [];
  const selectedSites = AUDIT_SITES.filter((site) => requestedSites.includes(site));
  if (!selectedSites.length || selectedSites.length !== new Set(requestedSites).size) {
    return NextResponse.json({ error: "검증할 사이트를 하나 이상 올바르게 선택해주세요." }, { status: 400 });
  }
  const from = parseAuditDate(fromText);
  const to = parseAuditDate(toText);
  if (!from || !to || from > to) {
    return NextResponse.json({ error: "from and to must use YYYY-MM-DD" }, { status: 400 });
  }
  const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  if (days > 190) {
    return NextResponse.json({ error: "검증 범위는 최대 190일입니다." }, { status: 400 });
  }
  const running = await prisma.inventory_audit_job.findFirst({
    where: { status: { in: ["pending", "processing"] } },
    orderBy: { id: "desc" },
  });
  if (running) {
    return NextResponse.json(
      { error: "이미 진행 중인 검증이 있습니다.", id: running.id.toString() },
      { status: 409 }
    );
  }

  const completedCandidates = await prisma.inventory_audit_job.findMany({
    where: { from_date: from, to_date: to, status: "completed" },
    orderBy: { id: "desc" },
    take: 10,
  });
  // Reuse only a clean report. A completed report containing inspection
  // errors or an older site/product target set must be runnable again after
  // a site reader is repaired or inventory products are added.
  let completed: (typeof completedCandidates)[number] | null = null;
  const expectedTargetKeys = new Set(
    allTargetsForDay(selectedSites as AuditSite[]).map(
      (target) => `${target.site}:${target.product}`
    )
  );
  for (const candidate of completedCandidates) {
    if (candidate.error_count !== 0) continue;
    const candidateTargets = await prisma.inventory_audit_check.findMany({
      where: { job_id: candidate.id },
      distinct: ["site", "product"],
      select: { site: true, product: true },
    });
    const existingTargetKeys = new Set(
      candidateTargets.map((row) => `${row.site}:${row.product}`)
    );
    if (
      expectedTargetKeys.size === existingTargetKeys.size &&
      [...expectedTargetKeys].every((key) => existingTargetKeys.has(key))
    ) {
      completed = candidate;
      break;
    }
  }
  if (completed) {
    return NextResponse.json({
      id: completed.id.toString(),
      status: completed.status,
      totalChecks: completed.total_checks,
      reused: true,
    });
  }

  const endExclusive = new Date(to);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const reservations = await prisma.reservation.findMany({
    where: { type: "pension", use_date: { lt: endExclusive } },
    orderBy: [{ use_date: "asc" }, { id: "asc" }],
  });
  const overlapping = reservations.filter((row) => {
    const checkout = new Date(row.use_date);
    checkout.setUTCDate(checkout.getUTCDate() + Math.max(1, row.nights || 1));
    return checkout > from;
  });
  const checks = buildAuditChecks(overlapping, from, to, selectedSites as AuditSite[]);
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.inventory_audit_job.create({
      data: { from_date: from, to_date: to, total_checks: checks.length },
    });
    await tx.inventory_audit_check.createMany({
      data: checks.map((check) => ({ ...check, job_id: created.id })),
    });
    return created;
  });
  return NextResponse.json(
    { id: job.id.toString(), status: job.status, totalChecks: checks.length, reused: false },
    { status: 201 }
  );
}
