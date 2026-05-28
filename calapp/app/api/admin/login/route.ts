import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const normalizedUsername = username.trim();
  const normalizedPassword = password.trim();

  const admin = await prisma.admin.findFirst({
    where: {
      username: {
        equals: normalizedUsername,
        mode: "insensitive",
      },
    },
  });

  if (!admin) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const passwordMatches =
    admin.password === normalizedPassword ||
    (admin.password.startsWith("$2") &&
      (await bcrypt.compare(normalizedPassword, admin.password)));

  if (!passwordMatches) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
