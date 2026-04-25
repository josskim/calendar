import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_HOLIDAYS, type HolidaySeed } from "@/lib/holiday-defaults";
import { holidayPool } from "@/lib/holiday-db";

type HolidayRecord = {
  id: number;
  date: string;
  name: string;
  source: string;
};

type HolidayDateRow = {
  date: string;
};

type HolidayRow = {
  id: number;
  date: string;
  name: string;
  source: string;
};

async function seedDefaultHolidaysIfNeeded() {
  const existingResult = await holidayPool.query(
    `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date FROM holidays`
  );
  const existingDates = new Set((existingResult.rows as HolidayDateRow[]).map((row) => row.date));

  for (const holiday of DEFAULT_HOLIDAYS as HolidaySeed[]) {
    if (existingDates.has(holiday.date)) continue;
    await holidayPool.query(
      `
        INSERT INTO holidays (date, name, source)
        VALUES (($1::date)::timestamp, $2, 'default')
        ON CONFLICT (date) DO NOTHING
      `,
      [holiday.date, holiday.name]
    );
  }
}

export async function GET() {
  try {
    await seedDefaultHolidaysIfNeeded();

    const result = await holidayPool.query(
      `
        SELECT id, TO_CHAR(date, 'YYYY-MM-DD') AS date, name, source
        FROM holidays
        ORDER BY date ASC, id ASC
      `
    );

    const holidays: HolidayRecord[] = (result.rows as HolidayRow[]).map((holiday: HolidayRow) => ({
      id: holiday.id,
      date: holiday.date,
      name: holiday.name,
      source: holiday.source,
    }));

    return NextResponse.json(holidays);
  } catch (error) {
    console.error("Failed to fetch holidays", error);
    return NextResponse.json({ error: "Failed to fetch holidays" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const date = String(body.date ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!date || !name) {
      return NextResponse.json({ error: "date and name required" }, { status: 400 });
    }

    const result = await holidayPool.query(
      `
        INSERT INTO holidays (date, name, source)
        VALUES (($1::date)::timestamp, $2, 'custom')
        ON CONFLICT (date)
        DO UPDATE SET
          name = EXCLUDED.name,
          source = EXCLUDED.source
        RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') AS date, name, source
      `,
      [date, name]
    );

    const saved = (result.rows as HolidayRow[])[0];
    return NextResponse.json({
      id: saved.id,
      date: saved.date,
      name: saved.name,
      source: saved.source,
    });
  } catch (error) {
    console.error("Failed to save holiday", error);
    return NextResponse.json({ error: "Failed to save holiday" }, { status: 500 });
  }
}
