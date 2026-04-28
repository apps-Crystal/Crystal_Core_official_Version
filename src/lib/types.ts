/**
 * Crystal Core — shared domain types.
 *
 * These mirror the columns of the Google Sheet "USERS":
 *   user_id | email | name | Phone | is_active | created_at | updated_at
 *   | last_login_at | Password | Access | Role | Status
 *
 * `Access` stores the JSON list of system codes the user can reach
 * (e.g. ["procurement","wms"]).  `Status` is the approval lifecycle.
 */

export const ROLES = ["developer", "manager", "supervisor", "security", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ACCESS_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

export const SYSTEMS = ["crystal_core", "procurement", "wms", "hiring", "reports"] as const;
export type SystemCode = (typeof SYSTEMS)[number];

/** Raw shape returned by the Apps Script connector (string-typed cells). */
export interface UserRow {
  user_id: string;
  email: string;
  name: string;
  Phone: string;
  is_active: string;          // "TRUE" | "FALSE"
  created_at: string;
  updated_at: string;
  last_login_at: string;
  Password: string;           // bcrypt hash
  Access: string;             // JSON array of system codes
  Role: Role | "";
  Status: AccessStatus | "";
}

/** Normalised, app-friendly user. */
export interface User {
  userId: string;
  email: string;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  role: Role | null;
  accessStatus: AccessStatus;
  systemsAccess: SystemCode[];
}

/** What we put inside the JWT.  Kept small — large claims bloat every request. */
export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  systemsAccess: SystemCode[];
}

/** Standard JSON envelope for API responses. */
export type ApiResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };
