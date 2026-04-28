/**
 * GET /api/auth/me — returns the current session user (from the JWT).
 * Used by the UI to bootstrap "who am I".
 */

import { NextRequest } from "next/server";
import { fail, getSessionFromRequest, ok } from "@/lib/api";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return fail("Unauthorized", 401, "NO_SESSION");
  return ok({ user: session });
}
