/**
 * Role-based access control.
 *
 * Crystal Core is the identity provider for the Crystal Group system family.
 * Each role grants a default set of system codes; an approver can override
 * those defaults per-user (stored in USERS.Access).
 *
 *   developer  → everything (+ may approve users and grant access)
 *   manager    → all business systems, no admin
 *   supervisor → operational systems
 *   security   → read-only / restricted surfaces
 *   admin      → configurable (default: crystal_core only — dev assigns the rest)
 */

import type { Role, SessionUser, SystemCode } from "./types";

export const DEFAULT_SYSTEMS_BY_ROLE: Record<Role, SystemCode[]> = {
  developer:  ["crystal_core", "procurement", "wms", "hiring", "reports"],
  manager:    ["procurement", "wms", "reports"],
  supervisor: ["wms", "procurement"],
  security:   ["wms"],
  admin:      ["crystal_core"],
};

/** Roles allowed to use the approval dashboard. */
export const APPROVER_ROLES: Role[] = ["developer"];

export function canApproveUsers(role: Role | null | undefined): boolean {
  return !!role && APPROVER_ROLES.includes(role);
}

export function hasSystemAccess(user: SessionUser, system: SystemCode): boolean {
  return user.systemsAccess.includes(system);
}

export function hasRole(user: SessionUser, ...roles: Role[]): boolean {
  return roles.includes(user.role);
}

/**
 * Routes that require *any* authenticated session.
 * Anything not listed here is treated as public (login/signup/static).
 */
export const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/api/admin", "/api/auth/me"];

/** Routes that require a specific role. */
export const ROLE_GATED_PREFIXES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin",      roles: APPROVER_ROLES },
  { prefix: "/api/admin",  roles: APPROVER_ROLES },
];

export function requiresAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function requiredRolesFor(pathname: string): Role[] | null {
  const match = ROLE_GATED_PREFIXES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
  return match ? match.roles : null;
}
