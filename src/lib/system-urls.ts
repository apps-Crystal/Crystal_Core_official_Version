/**
 * Where each downstream system lives.
 * Driven by env vars so the same code works locally and in prod.
 *
 *   Local: SYSTEM_URL_WMS=http://localhost:3001
 *   Prod:  SYSTEM_URL_WMS=https://wms.crystalgroup.in
 *
 * Returns null when the env var is unset — the dashboard greys out
 * the tile in that case instead of producing a broken link.
 */

import type { SystemCode } from "./types";

export const SYSTEM_DISPLAY_NAMES: Record<SystemCode, string> = {
  crystal_core: "Crystal Core",
  procurement:  "Procurement",
  wms:          "Warehouse Management",
  hiring:       "Hiring",
  reports:      "Reports",
};

export function getSystemUrl(system: SystemCode): string | null {
  const map: Record<SystemCode, string | undefined> = {
    crystal_core: process.env.SYSTEM_URL_CRYSTAL_CORE,
    procurement:  process.env.SYSTEM_URL_PROCUREMENT,
    wms:          process.env.SYSTEM_URL_WMS,
    hiring:       process.env.SYSTEM_URL_HIRING,
    reports:      process.env.SYSTEM_URL_REPORTS,
  };
  const raw = map[system]?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}
