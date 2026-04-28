/**
 * Apps Script connector — the ONLY module that talks to the spreadsheet.
 *
 * Why a connector instead of the Sheets API directly?
 *   • No service-account JSON to ship with the Next.js app.
 *   • The script owner controls all sheet access; the Next.js app holds only
 *     a URL + shared secret.
 *   • Easier to swap to a real database later — replace this file's
 *     implementation, leave the higher-level `users.ts` repository alone.
 *
 * Wire format: every request is POST + JSON, includes { secret, action, payload }.
 * The Apps Script web app verifies `secret` against its Script Property
 * `SCRIPT_SHARED_SECRET` and dispatches on `action`.
 */

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const SHARED_SECRET = process.env.APPS_SCRIPT_SHARED_SECRET;

if (!APPS_SCRIPT_URL || !SHARED_SECRET) {
  // Don't throw at import time — the build must still pass without secrets.
  // We throw lazily on first call so dev-time misconfig is loud at request time.
  if (process.env.NODE_ENV === "production") {
    console.warn("[apps-script] APPS_SCRIPT_URL / APPS_SCRIPT_SHARED_SECRET not set");
  }
}

export type AppsScriptAction =
  | "users.list"
  | "users.findByEmail"
  | "users.findById"
  | "users.create"
  | "users.update";

interface AppsScriptResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function callAppsScript<T = unknown>(
  action: AppsScriptAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!APPS_SCRIPT_URL || !SHARED_SECRET) {
    throw new Error(
      "[apps-script] Missing APPS_SCRIPT_URL or APPS_SCRIPT_SHARED_SECRET env vars.",
    );
  }

  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: SHARED_SECRET, action, payload }),
    // Apps Script returns 302→ the actual content; Node fetch follows by default.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`[apps-script] HTTP ${res.status} for action "${action}"`);
  }

  const json = (await res.json()) as AppsScriptResponse<T>;
  if (!json.ok) {
    throw new Error(`[apps-script] action "${action}" failed: ${json.error ?? "unknown"}`);
  }
  return json.data as T;
}
