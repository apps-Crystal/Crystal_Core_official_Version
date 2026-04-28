/**
 * POST /api/auth/signup
 *
 * Body: { email, name, phone, password }
 *
 *  • Validates input.
 *  • Rejects duplicate emails.
 *  • Hashes the password (bcrypt).
 *  • Stores user with Status="pending" — login is blocked until a developer
 *    approves the account from the admin dashboard.
 *  • Bootstrap: emails listed in BOOTSTRAP_DEVELOPER_EMAILS are auto-approved
 *    as `developer` so the very first deploy isn't a chicken-and-egg problem.
 */

import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/passwords";

export const runtime = "nodejs";
import { fail, ok } from "@/lib/api";
import { clientKey, limit } from "@/lib/rate-limit";
import { createUser, findUserByEmail } from "@/lib/users";
import { DEFAULT_SYSTEMS_BY_ROLE } from "@/lib/rbac";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bootstrapEmails(): string[] {
  return (process.env.BOOTSTRAP_DEVELOPER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  const rl = limit(clientKey(req, "signup"), { max: 5, windowMs: 60_000 });
  if (!rl.ok) return fail("Too many signup attempts. Try again shortly.", 429, "RATE_LIMITED");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");

  if (!email || !EMAIL_RE.test(email)) return fail("A valid email is required.", 400);
  if (name.length < 2)                 return fail("Name is required.", 400);
  if (password.length < 8)             return fail("Password must be at least 8 characters.", 400);

  const existing = await findUserByEmail(email);
  if (existing) return fail("An account with this email already exists.", 409, "EMAIL_TAKEN");

  const passwordHash = await hashPassword(password);
  const isBootstrap = bootstrapEmails().includes(email);

  const user = await createUser({
    email,
    name,
    phone,
    passwordHash,
    role: isBootstrap ? "developer" : null,
    accessStatus: isBootstrap ? "approved" : "pending",
    systemsAccess: isBootstrap ? DEFAULT_SYSTEMS_BY_ROLE.developer : [],
    isActive: true,
  });

  return ok(
    {
      userId: user.userId,
      email: user.email,
      accessStatus: user.accessStatus,
      message: isBootstrap
        ? "Bootstrap developer account created. You can log in now."
        : "Account created. A developer must approve your access before you can log in.",
    },
    { status: 201 },
  );
}
