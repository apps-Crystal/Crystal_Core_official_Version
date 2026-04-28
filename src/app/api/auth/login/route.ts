/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 *
 *  • Looks up user, verifies bcrypt hash.
 *  • Refuses login unless is_active=TRUE AND Status=approved.
 *  • Issues a JWT containing { userId, role, systemsAccess } and sets it as
 *    an HttpOnly cookie.  Token is also returned in the JSON body so non-web
 *    clients (mobile, integrations) can use Bearer auth.
 */

import { NextRequest } from "next/server";
import { COOKIE_NAME, sessionCookieOptions, signJwt } from "@/lib/auth";
import { verifyPassword } from "@/lib/passwords";

export const runtime = "nodejs";
import { fail, ok } from "@/lib/api";
import { clientKey, limit } from "@/lib/rate-limit";
import { findUserRowByEmail, updateUser } from "@/lib/users";
import { DEFAULT_SYSTEMS_BY_ROLE } from "@/lib/rbac";
import type { Role, SessionUser, SystemCode } from "@/lib/types";

export async function POST(req: NextRequest) {
  const rl = limit(clientKey(req, "login"), { max: 10, windowMs: 60_000 });
  if (!rl.ok) return fail("Too many login attempts. Try again shortly.", 429, "RATE_LIMITED");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return fail("Email and password are required.", 400);

  const row = await findUserRowByEmail(email);
  // Same generic error for "no user" and "wrong password" — don't leak which.
  if (!row) return fail("Invalid email or password.", 401, "BAD_CREDENTIALS");

  const valid = await verifyPassword(password, row.Password);
  if (!valid) return fail("Invalid email or password.", 401, "BAD_CREDENTIALS");

  if (String(row.is_active).toUpperCase() !== "TRUE") {
    return fail("Account is deactivated. Contact a developer.", 403, "INACTIVE");
  }
  if (row.Status !== "approved") {
    return fail(
      row.Status === "rejected"
        ? "Account access was rejected. Contact a developer."
        : "Account is awaiting developer approval.",
      403,
      row.Status === "rejected" ? "REJECTED" : "PENDING_APPROVAL",
    );
  }
  if (!row.Role) {
    return fail("Account has no role assigned. Contact a developer.", 403, "NO_ROLE");
  }

  // Resolve effective systems access: per-user list if set, else role default.
  let systemsAccess: SystemCode[];
  try {
    const parsed = row.Access ? (JSON.parse(row.Access) as SystemCode[]) : [];
    systemsAccess = parsed.length ? parsed : DEFAULT_SYSTEMS_BY_ROLE[row.Role as Role];
  } catch {
    systemsAccess = DEFAULT_SYSTEMS_BY_ROLE[row.Role as Role];
  }

  const sessionUser: SessionUser = {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.Role as Role,
    systemsAccess,
  };

  const jwt = await signJwt(sessionUser);

  // Best-effort last-login update — don't fail the login if the sheet write hiccups.
  updateUser(row.user_id, { lastLoginAt: new Date().toISOString() }).catch((err) => {
    console.warn("[login] failed to update last_login_at:", err);
  });

  const res = ok({ user: sessionUser, token: jwt });
  res.cookies.set(COOKIE_NAME, jwt, sessionCookieOptions());
  return res;
}
