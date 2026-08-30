import { NextRequest } from "next/server";
import {
  DELETE as cancelInventoryAudit,
  GET as getInventoryAudit,
} from "@/app/api/admin/inventory-audits/[id]/route";
import { requireStaySyncToken } from "@/lib/mobile-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Read progress/results or stop an audit from StaySync. Both operations use
 * the same release token as the existing mobile reservation APIs.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const authError = requireStaySyncToken(req);
  if (authError) return authError;
  return getInventoryAudit(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authError = requireStaySyncToken(req);
  if (authError) return authError;
  return cancelInventoryAudit(req, context);
}
