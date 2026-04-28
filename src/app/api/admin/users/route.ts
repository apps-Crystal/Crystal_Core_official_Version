/**
 * GET /api/admin/users          → list all users
 * GET /api/admin/users?status=pending → filter by approval status
 *
 * Middleware already gates this to APPROVER_ROLES (developer).
 */

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { listUsers } from "@/lib/users";
import { ACCESS_STATUSES, type AccessStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  if (status && !ACCESS_STATUSES.includes(status as AccessStatus)) {
    return fail(`Invalid status. One of: ${ACCESS_STATUSES.join(", ")}`, 400);
  }

  const users = await listUsers();
  const filtered = status ? users.filter((u) => u.accessStatus === status) : users;

  // Strip nothing sensitive — `User` already excludes the password hash.
  return ok({ users: filtered, total: filtered.length });
}
