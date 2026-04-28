/**
 * PATCH /api/admin/users/:userId
 *
 * Body (any subset):
 *   { decision: "approve" | "reject" | "suspend",
 *     role: "manager",
 *     systemsAccess: ["procurement","wms"],
 *     isActive: true }
 *
 * Used by the developer dashboard to approve / reject / re-grant access.
 *
 * Middleware already gates this to APPROVER_ROLES (developer).
 */

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { findUserById, updateUser } from "@/lib/users";
import { DEFAULT_SYSTEMS_BY_ROLE } from "@/lib/rbac";
import { ROLES, SYSTEMS, type AccessStatus, type Role, type SystemCode } from "@/lib/types";

interface PatchBody {
  decision?: "approve" | "reject" | "suspend";
  role?: Role;
  systemsAccess?: SystemCode[];
  isActive?: boolean;
}

const DECISION_TO_STATUS: Record<NonNullable<PatchBody["decision"]>, AccessStatus> = {
  approve: "approved",
  reject:  "rejected",
  suspend: "suspended",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const { userId } = params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  // Validate role
  if (body.role !== undefined && !ROLES.includes(body.role)) {
    return fail(`Invalid role. One of: ${ROLES.join(", ")}`, 400);
  }
  // Validate systems
  if (body.systemsAccess !== undefined) {
    if (!Array.isArray(body.systemsAccess)) return fail("systemsAccess must be an array.", 400);
    const bad = body.systemsAccess.filter((s) => !SYSTEMS.includes(s));
    if (bad.length) return fail(`Unknown system code(s): ${bad.join(", ")}`, 400);
  }

  const existing = await findUserById(userId);
  if (!existing) return fail("User not found.", 404);

  // Approving requires a role.  If the dev didn't pass one and the user has
  // none yet, refuse — defaults shouldn't silently grant developer privileges.
  if (body.decision === "approve") {
    const role = body.role ?? existing.role;
    if (!role) return fail("A role is required when approving a user.", 400);
  }

  const patch: Parameters<typeof updateUser>[1] = {};
  if (body.decision)             patch.accessStatus = DECISION_TO_STATUS[body.decision];
  if (body.role !== undefined)   patch.role = body.role;
  if (body.isActive !== undefined) patch.isActive = body.isActive;

  if (body.systemsAccess !== undefined) {
    patch.systemsAccess = body.systemsAccess;
  } else if (body.decision === "approve" && body.role && existing.systemsAccess.length === 0) {
    // Approving with a fresh role and no per-user override → seed defaults.
    patch.systemsAccess = DEFAULT_SYSTEMS_BY_ROLE[body.role];
  }

  const updated = await updateUser(userId, patch);
  return ok({ user: updated });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const user = await findUserById(params.userId);
  if (!user) return fail("User not found.", 404);
  return ok({ user });
}
