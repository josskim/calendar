const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function readRootDatabaseUrl() {
  const envPath = path.resolve(__dirname, "..", "..", ".env");
  if (!fs.existsSync(envPath)) return null;

  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/^\s*DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);
  return match?.[1]?.trim() || null;
}

const inputPath = path.resolve(__dirname, "..", "..", "doc", "2026 공휴일 적용기간.txt");
const raw = fs.readFileSync(inputPath, "utf8");
const lines = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const entries = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/^26\.\s*(\d{1,2})\.\s*(\d{1,2})\.\(([^)]+)\)$/);
  if (!match) continue;

  const month = String(Number(match[1])).padStart(2, "0");
  const day = String(Number(match[2])).padStart(2, "0");
  const name = lines[i + 1];
  const next = lines[i + 2];
  if (!name || !next) continue;
  if (next !== "영업") continue;

  entries.push({
    date: `2026-${month}-${day}`,
    name,
    source: "default",
  });
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    readRootDatabaseUrl() ||
    "postgresql://postgres:hare2580%40%40@localhost:5432/cal_reservation?schema=public";

  const pool = new Pool({ connectionString });

  try {
    for (const entry of entries) {
      await pool.query(
        `
          INSERT INTO holidays (date, name, source)
          VALUES (($1::date)::timestamp, $2, $3)
          ON CONFLICT (date)
          DO UPDATE SET
            name = EXCLUDED.name,
            source = EXCLUDED.source
        `,
        [entry.date, entry.name, entry.source]
      );
    }

    console.log(`Synced ${entries.length} holidays from doc.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
