/**
 * USERS repository.
 *
 * All higher-level code (API routes, dashboards) goes through this module.
 * It hides the Apps Script wire format and converts between the raw
 * sheet-row shape (`UserRow`) and the app-friendly `User` shape.
 *
 * Migrating off Google Sheets later means rewriting THIS file only —
 * route handlers and UI never change.
 */

import { callAppsScript } from "./apps-script";
import type {
  AccessStatus,
  Role,
  SystemCode,
  User,
  UserRow,
} from "./types";

// ─── (de)serialisation ────────────────────────────────────────────────────

function parseAccess(raw: string): SystemCode[] {
  if (!raw) return [];
  // Tolerate both JSON arrays and CSVs — humans editing the sheet manually
  // tend to type "procurement, wms" instead of '["procurement","wms"]'.
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith("[")) return JSON.parse(trimmed) as SystemCode[];
  } catch {
    /* fall through to CSV */
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as SystemCode[];
}

function rowToUser(row: UserRow): User {
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    phone: row.Phone,
    isActive: String(row.is_active).toUpperCase() === "TRUE",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    role: (row.Role || null) as Role | null,
    accessStatus: (row.Status || "pending") as AccessStatus,
    systemsAccess: parseAccess(row.Access),
  };
}

// ─── reads ────────────────────────────────────────────────────────────────

export async function listUsers(): Promise<User[]> {
  const rows = await callAppsScript<UserRow[]>("users.list");
  return rows.map(rowToUser);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await callAppsScript<UserRow | null>("users.findByEmail", {
    email: email.toLowerCase().trim(),
  });
  return row ? rowToUser(row) : null;
}

export async function findUserById(userId: string): Promise<User | null> {
  const row = await callAppsScript<UserRow | null>("users.findById", { userId });
  return row ? rowToUser(row) : null;
}

/** Internal helper — returns the row including the password hash. */
export async function findUserRowByEmail(email: string): Promise<UserRow | null> {
  return await callAppsScript<UserRow | null>("users.findByEmail", {
    email: email.toLowerCase().trim(),
  });
}

// ─── writes ───────────────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
  role?: Role | null;
  accessStatus?: AccessStatus;
  systemsAccess?: SystemCode[];
  isActive?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const now = new Date().toISOString();
  const userId = `USR-${Date.now().toString(36).toUpperCase()}-${Math
    .floor(Math.random() * 1e4)
    .toString()
    .padStart(4, "0")}`;

  const row: UserRow = {
    user_id: userId,
    email: input.email.toLowerCase().trim(),
    name: input.name.trim(),
    Phone: input.phone.trim(),
    is_active: input.isActive === false ? "FALSE" : "TRUE",
    created_at: now,
    updated_at: now,
    last_login_at: "",
    Password: input.passwordHash,
    Access: JSON.stringify(input.systemsAccess ?? []),
    Role: (input.role ?? "") as Role | "",
    Status: input.accessStatus ?? "pending",
  };

  const created = await callAppsScript<UserRow>("users.create", { row });
  return rowToUser(created);
}

export interface UpdateUserPatch {
  name?: string;
  phone?: string;
  isActive?: boolean;
  passwordHash?: string;
  role?: Role | null;
  accessStatus?: AccessStatus;
  systemsAccess?: SystemCode[];
  lastLoginAt?: string;
}

export async function updateUser(userId: string, patch: UpdateUserPatch): Promise<User> {
  const now = new Date().toISOString();
  const fields: Partial<UserRow> = { updated_at: now };

  if (patch.name !== undefined)         fields.name = patch.name.trim();
  if (patch.phone !== undefined)        fields.Phone = patch.phone.trim();
  if (patch.isActive !== undefined)     fields.is_active = patch.isActive ? "TRUE" : "FALSE";
  if (patch.passwordHash !== undefined) fields.Password = patch.passwordHash;
  if (patch.role !== undefined)         fields.Role = (patch.role ?? "") as Role | "";
  if (patch.accessStatus !== undefined) fields.Status = patch.accessStatus;
  if (patch.systemsAccess !== undefined) fields.Access = JSON.stringify(patch.systemsAccess);
  if (patch.lastLoginAt !== undefined)  fields.last_login_at = patch.lastLoginAt;

  const updated = await callAppsScript<UserRow>("users.update", { userId, fields });
  return rowToUser(updated);
}
