import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireInventoryWorkerToken } from "@/lib/worker-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const authError = requireInventoryWorkerToken(req);
  if (authError) return authError;

  const { id } = await context.params;
  let eventId: bigint;
  try {
    eventId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const current = await prisma.inventory_event.findUnique({ where: { id: eventId } });
  if (!current) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (action === "complete") {
    const updated = await prisma.inventory_event.update({
      where: { id: eventId },
      data: {
        status: "completed",
        completed_at: new Date(),
        last_error: null,
        result: (body?.result ?? {}) as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ id, status: updated.status });
  }

  if (action === "retry" || action === "fail") {
    const retrySeconds = Math.max(
      15,
      Math.min(3600, Number(body?.retrySeconds ?? 60) || 60)
    );
    const terminal = action === "fail";
    const updated = await prisma.inventory_event.update({
      where: { id: eventId },
      data: {
        status: terminal ? "failed" : "retrying",
        claimed_at: null,
        available_at: terminal
          ? current.available_at
          : new Date(Date.now() + retrySeconds * 1000),
        last_error: String(body?.error ?? "Worker failed").slice(0, 4000),
        result: (body?.result ?? {}) as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ id, status: updated.status });
  }

  return NextResponse.json(
    { error: "action must be complete, retry, or fail" },
    { status: 400 }
  );
}
