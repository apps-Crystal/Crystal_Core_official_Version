/**
 * GET /api/sso/launch?system=<code>&return=<optional URL>
 *
 *   1. No session     → 302 to /login?next=<this URL>  (return after login)
 *   2. Session, no access for this system → 302 to /dashboard?error=no_access
 *   3. Otherwise      → mint a 60-second one-shot JWT with purpose="launch"
 *                       and 302 to <system-url>/sso?token=…&return=…
 *
 * The destination system validates the token by calling
 * Crystal Core's POST /api/auth/verify, then mints its own session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, signJwt, verifyJwt } from "@/lib/auth";
import { hasSystemAccess } from "@/lib/rbac";
import { getSystemUrl } from "@/lib/system-urls";
import { SYSTEMS, type SystemCode } from "@/lib/types";

export const runtime = "nodejs";

const LAUNCH_TOKEN_TTL = "60s";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const system = url.searchParams.get("system") as SystemCode | null;
  const returnTo = url.searchParams.get("return") ?? "";

  if (!system || !SYSTEMS.includes(system)) {
    return NextResponse.json(
      { ok: false, error: `Unknown system. One of: ${SYSTEMS.join(", ")}` },
      { status: 400 },
    );
  }

  const baseUrl = getSystemUrl(system);
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: `${system} is not configured.` },
      { status: 503 },
    );
  }

  // 1. Auth gate
  const sessionToken = req.cookies.get(COOKIE_NAME)?.value;
  const session = sessionToken ? await verifyJwt(sessionToken) : null;

  if (!session) {
    const loginUrl = url.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Access gate
  if (!hasSystemAccess(session, system)) {
    const dash = url.clone();
    dash.pathname = "/dashboard";
    dash.search = "";
    dash.searchParams.set("error", "no_access");
    dash.searchParams.set("system", system);
    return NextResponse.redirect(dash);
  }

  // 3. Mint launch token + bounce
  const launchToken = await signJwt(session, {
    expiresIn: LAUNCH_TOKEN_TTL,
    purpose: "launch",
  });

  const target = new URL("/sso", baseUrl);
  target.searchParams.set("token", launchToken);
  if (returnTo) target.searchParams.set("return", returnTo);
  return NextResponse.redirect(target);
}
