import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

// The environment variable takes precedence. This fallback is a one-way digest
// paired with the private release token embedded in the locally built APK.
const RELEASE_TOKEN_DIGEST = Buffer.from(
  "69bd4fd220320e39a0bbe5f3917fea6f561459dfe8ef72d02ebc96a63b903d11",
  "hex"
);

export function requireStaySyncToken(req: NextRequest): NextResponse | null {
  const configured = process.env.STAYSYNC_API_TOKEN?.trim();
  const expectedDigest = configured ? digest(configured) : RELEASE_TOKEN_DIGEST;

  const authorization = req.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!supplied || !timingSafeEqual(digest(supplied), expectedDigest)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
