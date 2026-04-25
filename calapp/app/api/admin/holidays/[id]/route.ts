import { NextRequest, NextResponse } from "next/server";
import { holidayPool } from "@/lib/holiday-db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const date = String(body.date ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!id || !date || !name) {
      return NextResponse.json({ error: "id, date and name required" }, { status: 400 });
    }

    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const currentResult = await holidayPool.query(
      `SELECT id FROM holidays WHERE id = $1`,
      [parsedId]
    );
    const current = (currentResult.rows as { id: number }[])[0];
    if (!current) {
      return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
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

    const updated = (result.rows as { id: number; date: string; name: string; source: string }[])[0];
    if (updated.id !== current.id) {
      await holidayPool.query(`DELETE FROM holidays WHERE id = $1`, [current.id]);
    }

    return NextResponse.json({
      id: updated.id,
      date: updated.date,
      name: updated.name,
      source: updated.source,
    });
  } catch (error) {
    console.error("Failed to update holiday", error);
    return NextResponse.json({ error: "Failed to update holiday" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await holidayPool.query(`DELETE FROM holidays WHERE id = $1`, [parsedId]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete holiday", error);
    return NextResponse.json({ error: "Failed to delete holiday" }, { status: 500 });
  }
}
