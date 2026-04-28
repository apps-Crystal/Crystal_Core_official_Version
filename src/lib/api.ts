/**
 * Helpers for API route handlers.
 */

import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyJwt } from "./auth";
import type { ApiResponse, SessionUser } from "./types";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, init);
}

export function fail(error: string, status = 400, code?: string) {
  return NextResponse.json<ApiResponse<never>>({ ok: false, error, code }, { status });
}

/** Pulls the session from either the cookie or an `Authorization: Bearer …` header. */
export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    return verifyJwt(token);
  }

  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyJwt(decodeURIComponent(match[1]));
}
