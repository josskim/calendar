import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const pageStr = searchParams.get("page") || "1";
    const limitStr = searchParams.get("limit") || "20";

    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);
    const skip = (page - 1) * limit;

    try {
        const total = await prisma.reservation.count();
        const list = await prisma.reservation.findMany({
            skip,
            take: limit,
            orderBy: [{ use_date: "desc" }, { id: "desc" }],
        });

        return NextResponse.json({
            total,
            page,
            limit,
            items: list.map((r) => ({
                id: r.id.toString(),
                type: r.type,
                category: r.category,
                use_date: r.use_date.toISOString(),
                nights: r.nights,
                quantity: r.quantity,
                guest_name: r.guest_name,
                phone: r.phone,
                people_count: r.people_count,
                user_type: r.user_type,
                total_amount: r.total_amount,
                extra_amount: r.extra_amount,
                payment_status: r.payment_status,
                deposit_date: r.deposit_date.toISOString(),
                cancel_date: r.cancel_date.toISOString(),
                source: r.source,
                memo: r.memo,
                created_at: r.created_at.toISOString(),
            })),
        });
    } catch (error) {
        console.error("Failed to fetch reservation list:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
