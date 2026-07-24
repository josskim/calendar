import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function requireStaySyncToken(req: NextRequest): NextResponse | null {
  const configured = process.env.STAYSYNC_API_TOKEN?.trim();
  if (!configured) {
    return NextResponse.json(
      { error: "STAYSYNC_API_TOKEN is not configured" },
      { status: 503 }
    );
  }

  const authorization = req.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!supplied || !timingSafeEqual(digest(supplied), digest(configured))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
