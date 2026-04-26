import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
// @ts-ignore
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

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
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
