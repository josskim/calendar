import fs from "fs";
import path from "path";
import { Pool } from "pg";

function readRootDatabaseUrl() {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) return null;

  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/^\s*DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);
  return match?.[1]?.trim() || null;
}

const connectionString =
  process.env.DATABASE_URL ||
  readRootDatabaseUrl() ||
  "postgresql://postgres:hare2580%40%40@localhost:5432/cal_reservation?schema=public";

declare global {
  // eslint-disable-next-line no-var
  var holidayPool: any;
}

export const holidayPool =
  global.holidayPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  global.holidayPool = holidayPool;
}

export function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function fromIsoDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}
