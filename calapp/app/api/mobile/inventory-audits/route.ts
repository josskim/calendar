import { NextRequest } from "next/server";
import {
  GET as listInventoryAudits,
  POST as createInventoryAudit,
} from "@/app/api/admin/inventory-audits/route";
import { requireStaySyncToken } from "@/lib/mobile-auth";

/**
 * StaySync's authenticated view of the inventory audit queue.
 *
 * The actual audit remains opt-in: merely listing this endpoint never creates
 * or claims checks. POST is the only operation that can enqueue a new audit.
 */
export async function GET(req: NextRequest) {
  const authError = requireStaySyncToken(req);
  if (authError) return authError;
  return listInventoryAudits();
}

export async function POST(req: NextRequest) {
  const authError = requireStaySyncToken(req);
  if (authError) return authError;
  return createInventoryAudit(req);
}
