/**
 * Auth primitives — JWT only.
 *
 *   JWT sign/verify : jose                    (Edge + Node compatible)
 *   Cookie          : crystal_core_session    (HttpOnly, SameSite=Lax)
 *
 * Password hashing lives in `./passwords.ts` so the Edge middleware can
 * import this file without pulling bcrypt into its bundle.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { SessionUser } from "./types";

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!JWT_SECRET_RAW || JWT_SECRET_RAW.length < 32)) {
  // Fail loud at boot — a weak/missing secret is a real outage waiting to happen.
  throw new Error("[auth] JWT_SECRET must be set and >= 32 chars in production.");
}
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || "dev-only-insecure-secret-change-me-now-please-32+chars",
);

export const COOKIE_NAME = "crystal_core_session";
export const TOKEN_EXPIRY = process.env.JWT_EXPIRY || "8h";

export async function signJwt(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(user.userId)
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyJwt(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // Strip JWT-standard claims so the returned object is just our user shape.
    const { iat: _iat, exp: _exp, sub: _sub, ...rest } = payload as JWTPayload &
      Partial<SessionUser>;
    void _iat; void _exp; void _sub;
    return rest as unknown as SessionUser;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds = 8 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
