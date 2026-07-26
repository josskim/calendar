import { NextRequest, NextResponse } from "next/server";
import { requireStaySyncToken } from "@/lib/mobile-auth";
import {
  createStaySyncReservation,
  validateStaySyncInput,
} from "@/lib/staysync-reservation";

export async function POST(req: NextRequest) {
  const authError = requireStaySyncToken(req);
  if (authError) return authError;

  const parsed = validateStaySyncInput(await req.json().catch(() => null));
  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await createStaySyncReservation(parsed.data);
    if ("conflicts" in result) {
      return NextResponse.json(
        {
          error:
            parsed.data.reservationType === "campnic"
              ? "CAMPNIC_CAPACITY_FULL"
              : "OVERBOOKING_CONFLICT",
          conflicts: result.conflicts,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    console.error("StaySync reservation creation failed", error);
    return NextResponse.json(
      { error: "Reservation registration failed" },
      { status: 500 }
    );
  }
}
