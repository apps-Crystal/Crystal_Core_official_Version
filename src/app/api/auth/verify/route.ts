/**
 * POST /api/auth/verify
 *
 * The integration endpoint other Crystal Group systems call.
 * They send Crystal Core a JWT (issued by /api/auth/login) and get back
 * the user, role, and the systems they're allowed to use.
 *
 * Body : { token }
 *  — or — Authorization: Bearer <token>
 *
 * Response (success):
 *   { ok: true, data: {
 *       user: { userId, email, name },
 *       role: "manager",
 *       systemsAccess: ["procurement","wms"],
 *       allowed: true   // convenience: only true if `system` was passed and matches
 *   }}
 *
 * Optional `system` in the body lets the caller ask "is this user allowed
 * here?" in a single round-trip.
 *
 * GET is supported too — same shape, token from Authorization header only.
 */

import { NextRequest } from "next/server";
import { verifyJwt } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { hasSystemAccess } from "@/lib/rbac";
import { findUserById } from "@/lib/users";
import type { SystemCode } from "@/lib/types";

async function handle(token: string | null, system?: string) {
  if (!token) return fail("Missing token.", 400, "MISSING_TOKEN");

  const session = await verifyJwt(token);
  if (!session) return fail("Invalid or expired token.", 401, "INVALID_TOKEN");

  // Cross-check the live record so a deactivated user can't keep using their
  // un-expired JWT.  This is the freshness check we couldn't do in middleware.
  const user = await findUserById(session.userId);
  if (!user)              return fail("User no longer exists.", 401, "USER_GONE");
  if (!user.isActive)     return fail("User is deactivated.", 403, "INACTIVE");
  if (user.accessStatus !== "approved") {
    return fail("User access has been revoked.", 403, "NOT_APPROVED");
  }

  const allowed = system ? hasSystemAccess(session, system as SystemCode) : true;

  return ok({
    user: {
      userId: user.userId,
      email: user.email,
      name: user.name,
    },
    role: session.role,
    systemsAccess: session.systemsAccess,
    allowed,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body when caller uses Authorization header */
  }

  const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const token = (body.token as string | undefined) ?? headerToken;
  return handle(token, body.system as string | undefined);
}

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const system = req.nextUrl.searchParams.get("system") ?? undefined;
  return handle(headerToken, system);
}
