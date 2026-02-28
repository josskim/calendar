import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);

    try {
        // 해당 년도의 취소가 아닌 예약 모두 가져오기
        const reservations = await prisma.reservation.findMany({
            where: {
                use_date: {
                    gte: new Date(`${year}-01-01T00:00:00.000Z`),
                    lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
                },
                payment_status: { notIn: ["cancelled", "취소"] },
            },
            select: {
                id: true,
                use_date: true,
                type: true,
                total_amount: true,
                extra_amount: true,
                payment_status: true,
                source: true,
            },
        });

        const validReservations = reservations.filter((r) => {
            const status = String(r.payment_status ?? "").trim().toLowerCase();
            return status !== "cancelled" && status !== "취소";
        });

        // 월별 집계
        const monthlyData: Record<number, {
            count: number;
            total: number;
            pension: number;
            campnic: number;
            extra: number;
        }> = {};

        for (let m = 1; m <= 12; m++) {
            monthlyData[m] = { count: 0, total: 0, pension: 0, campnic: 0, extra: 0 };
        }

        for (const r of validReservations) {
            const date = new Date(r.use_date);
            // UTC 오프셋 보정 (한국 +9)
            const month = date.getUTCMonth() + 1;
            if (month < 1 || month > 12) continue;

            monthlyData[month].count += 1;
            const ta = r.total_amount ?? 0;
            const ea = r.extra_amount ?? 0;
            monthlyData[month].total += ta + ea;
            monthlyData[month].extra += ea;

            if (r.type === "campnic") {
                monthlyData[month].campnic += ta + ea;
            } else {
                monthlyData[month].pension += ta + ea;
            }
        }

        // 월별 배열로 변환
        const months = Object.entries(monthlyData).map(([month, data]) => ({
            month: parseInt(month),
            ...data,
        }));

        // 연간 합계
        const yearly = {
            count: validReservations.length,
            total: validReservations.reduce((s: number, r) => s + (r.total_amount ?? 0) + (r.extra_amount ?? 0), 0),
            pension: validReservations.filter(r => r.type !== "campnic").reduce((s: number, r) => s + (r.total_amount ?? 0) + (r.extra_amount ?? 0), 0),
            campnic: validReservations.filter(r => r.type === "campnic").reduce((s: number, r) => s + (r.total_amount ?? 0) + (r.extra_amount ?? 0), 0),
            extra: validReservations.reduce((s: number, r) => s + (r.extra_amount ?? 0), 0),
        };

        // 미정산 금액 (오늘 이후 전체 데이터)
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const unsettledRes = await prisma.reservation.findMany({
            where: {
                use_date: { gte: now },
                payment_status: { notIn: ["cancelled", "취소"] }
            },
            select: {
                source: true,
                total_amount: true,
                extra_amount: true
            }
        });

        const unsettled = {
            naver: 0,
            nol: 0,
            here: 0,
            airbnb: 0,
            phone: 0,
            other: 0,
            total: 0
        };

        unsettledRes.forEach(r => {
            const amt = (r.total_amount ?? 0) + (r.extra_amount ?? 0);
            const s = (r.source || "other").toLowerCase();
            if (s.includes("naver")) unsettled.naver += amt;
            else if (s.includes("nol") || s.includes("yanolja")) unsettled.nol += amt;
            else if (s.includes("here") || s.includes("yeogieottae")) unsettled.here += amt;
            else if (s.includes("airbnb")) unsettled.airbnb += amt;
            else if (s.includes("phone")) unsettled.phone += amt;
            else unsettled.other += amt;
            unsettled.total += amt;
        });

        return NextResponse.json({ year, yearly, months, unsettled });
    } catch (e) {
        console.error("Sales API error", e);
        return NextResponse.json({ error: "Failed to fetch sales data" }, { status: 500 });
    }
}
