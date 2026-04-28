/**
 * Edge middleware — JWT validation + role gate.
 *
 * Runs before every matched request.  We can't touch the database from the
 * Edge runtime, so we trust the signed JWT for role/access decisions and let
 * route handlers do the freshness checks (active, status) when they matter.
 */

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyJwt } from "@/lib/auth";
import { requiresAuth, requiredRolesFor } from "@/lib/rbac";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!requiresAuth(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyJwt(token) : null;

  if (!session) {
    // API → 401 JSON, page → redirect to /login with a return URL.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "NO_SESSION" },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const requiredRoles = requiredRolesFor(pathname);
  if (requiredRoles && !requiredRoles.includes(session.role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Forbidden", code: "ROLE_FORBIDDEN" },
        { status: 403 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Forward decoded identity to route handlers via headers.  Cheaper than
  // re-verifying the JWT inside every API route.
  const headers = new Headers(req.headers);
  headers.set("x-user-id", session.userId);
  headers.set("x-user-role", session.role);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/admin/:path*", "/api/auth/me"],
};
