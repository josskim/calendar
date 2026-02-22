import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const admin = await prisma.rdmin.findUnique({
    where: { username },
  });

  // NOTE: This matches your current setup (plain-text password in DB).
  if (!admin || admin.password !== password) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}

