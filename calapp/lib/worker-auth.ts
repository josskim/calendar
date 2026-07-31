import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function requireInventoryWorkerToken(
  req: NextRequest
): NextResponse | null {
  const expected = process.env.INVENTORY_WORKER_TOKEN?.trim() ?? "";
  const authorization = req.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (
    !expected ||
    !supplied ||
    !timingSafeEqual(digest(supplied), digest(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
