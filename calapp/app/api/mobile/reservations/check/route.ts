import { NextRequest, NextResponse } from "next/server";
import { requireStaySyncToken } from "@/lib/mobile-auth";
import {
  inspectStaySyncConflicts,
  validateStaySyncInput,
} from "@/lib/staysync-reservation";

export async function POST(req: NextRequest) {
  const authError = requireStaySyncToken(req);
  if (authError) return authError;

  const parsed = validateStaySyncInput(await req.json().catch(() => null));
  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const conflicts = await inspectStaySyncConflicts(parsed.data);
  return NextResponse.json({
    available: conflicts.length === 0,
    conflicts,
  });
}
